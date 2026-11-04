import { useState, type FormEvent } from 'react';
import { toast } from '@/hooks/use-toast';

const FALLBACK = 'Please try again, or email fetuilstechhub@gmail.com.';

export function useContactForm() {
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    setSending(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${data.get('firstName') ?? ''} ${data.get('lastName') ?? ''}`.trim(),
          email: data.get('email'),
          subject: data.get('subject'),
          message: data.get('message'),
          website: data.get('website'),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(response.status === 400 ? body.error : FALLBACK);
      }

      form.reset();
      toast({ title: 'Message sent', description: "Thanks! We'll get back to you soon." });
    } catch (err) {
      toast({
        title: "Your message wasn't sent",
        description: err instanceof Error && err.message !== 'Failed to fetch' ? err.message : FALLBACK,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return { sending, handleSubmit };
}
