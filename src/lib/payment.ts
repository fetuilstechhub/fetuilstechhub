// Until Paystack is live, customers finish on WhatsApp and pay by bank transfer.
export const ONLINE_PAYMENTS = import.meta.env.VITE_PAYMENT_MODE === 'paystack';

export const WHATSAPP_NUMBERS = ['2349038949791', '2348146743743'];

// 2349038949791 -> 0903 894 9791
export const phoneLabel = (n: string) => `0${n.slice(3)}`.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3');

export const whatsappLink = (message: string, number = WHATSAPP_NUMBERS[0]) =>
  `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
