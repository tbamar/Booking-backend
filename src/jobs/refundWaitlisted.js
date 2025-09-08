const cron = require("node-cron");
const axios = require("axios");
const WaitingList = require("../models/WaitingList");

cron.schedule("0 0 * * *", async () => {
  console.log("Initiating refund of the waitlisted bookings");

  const date = new Date();
  const now = new Date(date.getTime());
  console.log("system running");
  try {
    const expiredBookings = await WaitingList.aggregate([
      {
        $addFields: {
          fullDateTime: {
            $dateFromString: {
              dateString: {
                $concat: [
                  { $dateToString: { date: "$date", format: "%Y-%m-%d" } },
                  "T",
                  "$time",
                  ":00Z",
                ],
              },
            },
          },
        },
      },
      {
        $match: {
          paymentStatus: "Success",
          fullDateTime: {
            $lt: now,
          },
        },
      },
    ]);

    for (const booking of expiredBookings) {
      try {
        const paymentId = booking.paymentId;
        console.log(`Processing refund for payment ID: ${paymentId}`);

      
        const refundResponse = await axios.post(
          `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
          {
            amount: parseInt(process.env.AMOUNT) * 100, 
            speed: "normal",
            notes: {
              reason: "Automatic refund for expired waitlist booking"
            }
          },
          {
            auth: {
              username: process.env.RAZORPAY_ID,
              password: process.env.RAZORPAY_SECRET, 
            },
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        console.log(`Refund successful for payment ${paymentId}:`, refundResponse.data);

       
        await WaitingList.findByIdAndUpdate(booking._id, { 
          paymentStatus: "Refunded",
          refundId: refundResponse.data.id, 
          refundedAt: new Date()
        });

        console.log(`Updated booking ${booking._id} status to Refunded`);

      } catch (refundError) {
        console.error(`Failed to refund payment ${booking.paymentId}:`, {
          message: refundError.message,
          response: refundError.response?.data,
          status: refundError.response?.status
        });
        
       
        await WaitingList.findByIdAndUpdate(booking._id, { 
          paymentStatus: "Refund Failed",
          refundError: refundError.response?.data || refundError.message
        });
      }
    }
  } catch (error) {
    console.error("Error processing refunds:", error);
  }
});
