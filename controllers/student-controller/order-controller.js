const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../../models/Order");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");

// ✅ Check for required env variables at startup
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error("❌ Missing Razorpay environment variables.");
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ==================== CREATE ORDER ====================
const createOrder = async (req, res) => {
  try {
    const {
      userId,
      userName,
      userEmail,
      instructorId,
      instructorName,
      courseImage,
      courseTitle,
      courseId,
      coursePricing,
    } = req.body;

    // Validate
    if (!userId || !courseId || !coursePricing) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const price = Number(coursePricing);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, message: "Invalid coursePricing value." });
    }

    // Create Razorpay order
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: price * 100,
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      });
    } catch (err) {
      console.error("❌ Razorpay create order error:", err);
      return res.status(502).json({ success: false, message: "Failed to create order with Razorpay" });
    }

    // Save order in DB
    try {
      const newOrder = await Order.create({
        userId,
        userName,
        userEmail,
        orderStatus: "pending",
        paymentMethod: "razorpay",
        paymentStatus: "pending",
        orderDate: new Date(),
        instructorId,
        instructorName,
        courseImage,
        courseTitle,
        courseId,
        coursePricing: price,
        razorpayOrderId: razorpayOrder.id,
      });

      return res.status(201).json({
        success: true,
        data: {
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          orderId: newOrder._id,
          key: process.env.RAZORPAY_KEY_ID,
        },
      });
    } catch (err) {
      console.error("❌ Database save error (Order):", err);
      return res.status(500).json({ success: false, message: "Database error while saving order." });
    }
  } catch (err) {
    console.error("❌ Create order unknown error:", err);
    return res.status(500).json({ success: false, message: "Unexpected server error." });
  }
};

// ==================== CAPTURE PAYMENT & FINALIZE ORDER ====================
const capturePaymentAndFinalizeOrder = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      orderId,
    } = req.body;

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !orderId
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details in request body.",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ✅ Verify payment signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // ✅ Update order status
    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    await order.save();

    // ✅ Add course to student's purchased list
    const newCourseData = {
      courseId: order.courseId,
      title: order.courseTitle,
      instructorId: order.instructorId,
      instructorName: order.instructorName,
      dateOfPurchase: new Date(),
      courseImage: order.courseImage,
    };

    const studentCourses = await StudentCourses.findOne({
      userId: order.userId,
    });
    if (studentCourses) {
      studentCourses.courses.push(newCourseData);
      await studentCourses.save();
    } else {
      await StudentCourses.create({
        userId: order.userId,
        courses: [newCourseData],
      });
    }

    // ✅ Add student to course's student list
    await Course.findByIdAndUpdate(order.courseId, {
      $addToSet: {
        students: {
          studentId: order.userId,
          studentName: order.userName,
          studentEmail: order.userEmail,
          paidAmount: order.coursePricing,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Order confirmed",
      data: order,
    });
  } catch (err) {
    console.error("❌ Capture payment error:", err.stack || err);
    res.status(500).json({
      success: false,
      message: err.message || "Some error occurred while capturing payment.",
    });
  }
};

module.exports = { createOrder, capturePaymentAndFinalizeOrder };
