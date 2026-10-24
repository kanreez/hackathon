// A payment problem the renter should see, with the HTTP status to answer with
class PaymentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { PaymentError };
