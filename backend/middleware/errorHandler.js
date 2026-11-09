function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.code === 11000) {
    return res.status(409).json({ message: 'A record with that value already exists.' });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(error.errors).map((item) => item.message).join(' ') });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid identifier or field value.' });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body contains invalid JSON.' });
  }
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}

module.exports = errorHandler;