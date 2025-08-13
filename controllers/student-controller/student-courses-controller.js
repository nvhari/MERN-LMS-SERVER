const mongoose = require("mongoose");
const StudentCourses = require("../../models/StudentCourses");

const getCoursesByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate ID format
    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID format",
      });
    }

    const studentBoughtCourses = await StudentCourses.findOne({
      userId: studentId,
    });

    // If no record found, return empty array
    if (!studentBoughtCourses || !Array.isArray(studentBoughtCourses.courses)) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      data: studentBoughtCourses.courses,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

module.exports = { getCoursesByStudentId };
