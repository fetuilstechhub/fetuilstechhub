import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Mail, Clock, Phone, MessageSquare } from 'lucide-react';

const Contact = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
  };

  const faqs = [
    {
      question: 'How do I become a member?',
      answer:
        'Visit our hub during office hours with your student ID to register. Membership is free for all FET students.',
    },
    {
      question: 'What are the operating hours?',
      answer:
        'The hub is open 24/7 for registered members. Admin office hours are Mon-Fri, 8AM-5PM.',
    },
    {
      question: 'Are the training programs free?',
      answer:
        'Most basic programs are free for registered members. Advanced programs may have nominal fees.',
    },
    {
      question: 'Can non-FET students use the facilities?',
      answer:
        'Yes! All UNILORIN students are welcome, though FET students have priority access.',
    },
  ];

  return (
    <div className='min-h-screen bg-background'>
      <Navigation />

      {/* Hero Section */}
      <section className='pt-32 pb-20 relative overflow-hidden'>
        <div className='absolute inset-0 bg-grid-pattern opacity-20' />
        <div className='absolute top-1/2 left-0 w-[600px] h-[600px] bg-gradient-glow opacity-40' />

        <div className='container mx-auto px-6 relative'>
          <div className='max-w-4xl'>
            <span className='text-tech-label mb-4 block'>Contact Us</span>
            <h1 className='text-5xl md:text-6xl lg:text-7xl font-bold text-tech-heading mb-8'>
              Get In
              <br />
              <span className='text-primary'>Touch</span>
            </h1>
            <p className='text-xl text-muted-foreground max-w-2xl'>
              Have questions about our facilities, training programs, or
              membership? We'd love to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Info & Form */}
      <section className='py-24'>
        <div className='container mx-auto px-6'>
          <div className='max-w-7xl mx-auto grid lg:grid-cols-2 gap-16'>
            {/* Contact Info */}
            <div>
              <h2 className='text-2xl font-bold mb-8'>Contact Information</h2>

              <div className='space-y-6 mb-12'>
                <div className='flex items-start gap-4 p-6 rounded-2xl bg-card border border-border'>
                  <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0'>
                    <MapPin className='w-5 h-5 text-primary' />
                  </div>
                  <div>
                    <h4 className='font-semibold mb-1'>Location</h4>
                    <p className='text-muted-foreground'>
                      Faculty of Engineering & Technology,
                      <br />
                      University of Ilorin,
                      <br />
                      Ilorin, Kwara State, Nigeria
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-4 p-6 rounded-2xl bg-card border border-border'>
                  <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0'>
                    <Mail className='w-5 h-5 text-primary' />
                  </div>
                  <div>
                    <h4 className='font-semibold mb-1'>Email</h4>
                    <p className='text-muted-foreground'>info@fetuils.ng</p>
                    <p className='text-muted-foreground'>
                      fetuilstechhub@gmail.com
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-4 p-6 rounded-2xl bg-card border border-border'>
                  <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0'>
                    <Clock className='w-5 h-5 text-primary' />
                  </div>
                  <div>
                    <h4 className='font-semibold mb-1'>Working Hours</h4>
                    <p className='text-muted-foreground'>
                      Hub Access: 24/7 (Members Only)
                      <br />
                      Admin Office: Mon - Fri, 8AM - 5PM
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-4 p-6 rounded-2xl bg-card border border-border'>
                  <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0'>
                    <Phone className='w-5 h-5 text-primary' />
                  </div>
                  <div>
                    <h4 className='font-semibold mb-1'>Phone</h4>
                    <p className='text-muted-foreground'>+234 703 390 0578</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className='bg-card border border-border rounded-2xl p-8'>
              <h2 className='text-2xl font-bold mb-2'>Send a Message</h2>
              <p className='text-muted-foreground mb-8'>
                Fill out the form below and we'll get back to you within 24
                hours.
              </p>

              <form onSubmit={handleSubmit} className='space-y-6'>
                <div className='grid sm:grid-cols-2 gap-4'>
                  <div>
                    <label className='text-sm font-medium mb-2 block'>
                      First Name
                    </label>
                    <Input placeholder='John' className='bg-background' />
                  </div>
                  <div>
                    <label className='text-sm font-medium mb-2 block'>
                      Last Name
                    </label>
                    <Input placeholder='Doe' className='bg-background' />
                  </div>
                </div>

                <div>
                  <label className='text-sm font-medium mb-2 block'>
                    Email
                  </label>
                  <Input
                    type='email'
                    placeholder='john@student.unilorin.edu.ng'
                    className='bg-background'
                  />
                </div>

                <div>
                  <label className='text-sm font-medium mb-2 block'>
                    Subject
                  </label>
                  <Input
                    placeholder='How can we help?'
                    className='bg-background'
                  />
                </div>

                <div>
                  <label className='text-sm font-medium mb-2 block'>
                    Message
                  </label>
                  <Textarea
                    placeholder='Tell us more about your inquiry...'
                    className='bg-background min-h-[150px]'
                  />
                </div>

                <Button
                  type='submit'
                  className='w-full font-semibold'
                  size='lg'
                >
                  Send Message
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className='py-24 bg-muted/30'>
        <div className='container mx-auto px-6'>
          <div className='max-w-3xl mx-auto'>
            <div className='text-center mb-12'>
              <div className='w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6'>
                <MessageSquare className='w-7 h-7 text-primary' />
              </div>
              <h2 className='text-3xl font-bold mb-4'>
                Frequently Asked <span className='text-primary'>Questions</span>
              </h2>
              <p className='text-muted-foreground'>
                Quick answers to common questions about FETUILS TechHub.
              </p>
            </div>

            <div className='space-y-4'>
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className='p-6 rounded-2xl bg-card border border-border'
                >
                  <h3 className='font-semibold mb-2'>{faq.question}</h3>
                  <p className='text-muted-foreground'>{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
