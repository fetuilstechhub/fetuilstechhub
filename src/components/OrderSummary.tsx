import React from 'react';

type Props = {
  fullName: string;
  email: string;
  planTitle: string;
  amount: number;
  bookingDate: string;
};

const OrderSummary = ({ fullName, email, planTitle, amount, bookingDate }: Props) => {
  return (
    <div className="bg-card border border-border p-6 rounded-lg">
      <h3 className="text-lg font-bold mb-2">Order Summary</h3>
      <div className="text-sm text-muted-foreground space-y-1">
        <div><strong>Name:</strong> {fullName || '—'}</div>
        <div><strong>Email:</strong> {email || '—'}</div>
        <div><strong>Plan:</strong> {planTitle}</div>
        <div><strong>Booking Date:</strong> {bookingDate || '—'}</div>
        <div><strong>Amount:</strong> ₦{amount}</div>
      </div>
    </div>
  );
};

export default OrderSummary;
