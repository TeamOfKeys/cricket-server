class ErrorHandler {
  handle(err, req, res, next) {
    console.error(err.stack);
    
    if (err.type === 'validation') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.details
      });
    }

    if (err.name === 'MongoError' && err.code === 11000) {
      return res.status(409).json({
        error: 'Duplicate Entry',
        details: 'This record already exists'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred'
        : err.message
    });
  }
}

module.exports = new ErrorHandler();