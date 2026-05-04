import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function Confirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reference = searchParams.get('reference') || searchParams.get('trxref');

  useEffect(() => {
    const fetchBooking = async () => {
      if (!reference) {
        setError('No payment reference found. Payment may not have been completed.');
        setLoading(false);
        return;
      }

      try {
        // Fetch booking details from backend to verify payment status
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/booking-status?reference=${reference}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch booking details');
        }

        const data = await response.json();
        setBookingDetails(data);
        
        if (data.status !== 'paid') {
          setError('Payment verification pending. Please check your email for confirmation.');
        }
      } catch (err: any) {
        console.error('Error fetching booking:', err);
        setError('Could not verify booking. Payment may still be processing.');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [reference]);

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12'>
      <div className='max-w-2xl mx-auto'>
        {loading ? (
          <Card className='border-slate-700 bg-slate-900/50'>
            <CardContent className='pt-12 pb-12 text-center'>
              <div className='inline-block animate-spin'>
                <div className='h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full' />
              </div>
              <p className='mt-4 text-slate-300'>Verifying your payment...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className='border-slate-700 bg-slate-900/50'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-amber-500'>
                <AlertCircle className='h-6 w-6' />
                Payment Processing
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-sm text-slate-400'>
                {reference && (
                  <>
                    <strong>Reference:</strong> {reference}
                  </>
                )}
              </p>
              <p className='text-sm text-slate-400'>
                Please check your email inbox for a confirmation message. If you don't receive it within 5 minutes,
                contact support.
              </p>
              <Button onClick={() => navigate('/pricing')} className='w-full bg-orange-500 hover:bg-orange-600'>
                Return to Pricing
              </Button>
            </CardContent>
          </Card>
        ) : bookingDetails ? (
          <Card className='border-slate-700 bg-slate-900/50 fade-in-up'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-green-500'>
                <CheckCircle2 className='h-6 w-6' />
                Booking Confirmed!
              </CardTitle>
              <CardDescription>Your payment has been successfully processed</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* Order Summary */}
              <div className='bg-slate-800/50 rounded-lg p-4 space-y-3'>
                <h3 className='text-sm font-semibold text-slate-200'>Order Summary</h3>
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-slate-400'>Plan:</span>
                    <span className='text-white font-medium'>{bookingDetails.plan_title}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-slate-400'>Name:</span>
                    <span className='text-white font-medium'>{bookingDetails.full_name}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-slate-400'>Email:</span>
                    <span className='text-white font-medium'>{bookingDetails.email}</span>
                  </div>
                  {bookingDetails.start_time && (
                    <div className='flex justify-between'>
                      <span className='text-slate-400'>Booking Date:</span>
                      <span className='text-white font-medium'>
                        {new Date(bookingDetails.start_time).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className='border-t border-slate-700 pt-2 mt-2 flex justify-between font-semibold'>
                    <span>Total Amount:</span>
                    <span className='text-orange-500'>₦{bookingDetails.amount?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Reference */}
              <div className='bg-slate-800/50 rounded-lg p-4'>
                <h3 className='text-sm font-semibold text-slate-200 mb-2'>Payment Reference</h3>
                <code className='text-xs text-slate-400 break-all bg-slate-900 p-2 rounded block'>
                  {reference}
                </code>
              </div>

              {/* Next Steps */}
              <div className='bg-blue-500/10 border border-blue-500/20 rounded-lg p-4'>
                <h3 className='text-sm font-semibold text-blue-400 mb-2'>What's Next?</h3>
                <ul className='text-sm text-slate-300 space-y-1 list-disc list-inside'>
                  <li>A confirmation email has been sent to {bookingDetails.email}</li>
                  <li>Save your payment reference for your records</li>
                  <li>You can now access your booked workspace or service</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className='flex gap-3 pt-4'>
                <Button onClick={() => navigate('/pricing')} variant='outline' className='flex-1 border-slate-600'>
                  View Plans
                </Button>
                <Button onClick={() => navigate('/')} className='flex-1 bg-orange-500 hover:bg-orange-600'>
                  Back to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className='border-slate-700 bg-slate-900/50'>
            <CardContent className='pt-12 pb-12 text-center'>
              <AlertCircle className='h-12 w-12 text-slate-400 mx-auto mb-4' />
              <p className='text-slate-300 mb-4'>Could not load booking details</p>
              <Button onClick={() => navigate('/')} className='bg-orange-500 hover:bg-orange-600'>
                Return Home
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
