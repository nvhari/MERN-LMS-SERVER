const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userEmail: String,
  orderStatus: { type: String, default: 'pending' },    // pending | confirmed | cancelled
  paymentMethod: { type: String, default: 'razorpay' },
  paymentStatus: { type: String, default: 'pending' },  // pending | paid | failed
  orderDate: { type: Date, default: Date.now },

  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  instructorName: String,
  courseImage: String,
  courseTitle: String,
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  coursePricing: { type: Number, required: true },

  // Razorpay fields
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
});

module.exports = mongoose.model('Order', OrderSchema);
