import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Mail, Clock, Send } from "lucide-react";

const Contact = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
  };

  return (
    <section id="contact" className="py-24 md:py-32 bg-slate-50 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-6xl mx-auto bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(11,31,63,0.08)] overflow-hidden flex flex-col lg:flex-row reveal border border-gray-100">
          
          {/* Left Side: Contact Info (Dark Theme) */}
          <div className="w-full lg:w-5/12 bg-[#0B1F3F] p-10 md:p-14 text-white relative overflow-hidden flex flex-col justify-between">
            {/* Abstract background shapes */}
            {/* <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl point-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
             */}
            <div className="relative z-10">
              <span className="text-primary tracking-widest uppercase text-sm font-bold mb-4 block">Get In Touch</span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tighter leading-tight">
                Ready to <br/> 
                <span className="text-primary">Join Us?</span>
              </h2>
              <p className="text-gray-300 text-lg mb-12 font-light leading-relaxed">
                Have questions about our facilities, training programs, or how to become a member? 
                Reach out and we'll get back to you.
              </p>
              
              <div className="space-y-8">
                <div className="flex items-start gap-5 group">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:border-primary transition-all duration-300 shadow-sm">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1 tracking-tight">Location</h4>
                    <p className="text-gray-300 leading-relaxed font-light text-sm md:text-base">
                      Faculty of Engineering & Technology,<br />
                      University of Ilorin, Nigeria
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-5 group">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:border-primary transition-all duration-300 shadow-sm">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1 tracking-tight">Email</h4>
                    <p className="text-gray-300 font-light text-sm md:text-base">fetuilstechhub@gmail.com</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-5 group">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:border-primary transition-all duration-300 shadow-sm">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1 tracking-tight">Working Hours</h4>
                    <p className="text-gray-300 leading-relaxed font-light text-sm md:text-base">
                      Hub Access: 24/7<br />
                      Admin Office: Mon - Fri, 8AM - 5PM
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Side: Form (Light Theme) */}
          <div className="w-full lg:w-7/12 p-10 md:p-14 bg-white relative">
            <h3 className="text-2xl md:text-3xl font-extrabold text-[#0B1F3F] mb-8 tracking-tight">Send us a message</h3>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid sm:grid-cols-2 gap-8 lg:gap-10">
                <div className="group">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block group-focus-within:text-primary transition-colors">First Name</label>
                  <Input 
                    placeholder="John" 
                    className="border-0 border-b-2 border-gray-100 rounded-none px-0 py-2 bg-transparent focus-visible:ring-0 focus-visible:border-primary shadow-none text-lg font-medium text-[#0B1F3F] placeholder:font-light" 
                  />
                </div>
                <div className="group">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block group-focus-within:text-primary transition-colors">Last Name</label>
                  <Input 
                    placeholder="Doe" 
                    className="border-0 border-b-2 border-gray-100 rounded-none px-0 py-2 bg-transparent focus-visible:ring-0 focus-visible:border-primary shadow-none text-lg font-medium text-[#0B1F3F] placeholder:font-light" 
                  />
                </div>
              </div>
              
              <div className="group">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block group-focus-within:text-primary transition-colors">Email Address</label>
                <Input 
                  type="email" 
                  placeholder="john@example.com" 
                  className="border-0 border-b-2 border-gray-100 rounded-none px-0 py-2 bg-transparent focus-visible:ring-0 focus-visible:border-primary shadow-none text-lg font-medium text-[#0B1F3F] placeholder:font-light" 
                />
              </div>
              
              <div className="group">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block group-focus-within:text-primary transition-colors">Message</label>
                <Textarea 
                  placeholder="Tell us more about your inquiry..." 
                  className="border-0 border-b-2 border-gray-100 rounded-none px-0 py-2 bg-transparent focus-visible:ring-0 focus-visible:border-primary shadow-none text-lg font-medium text-[#0B1F3F] placeholder:font-light min-h-[100px] resize-none"
                />
              </div>
              
              <div className="pt-4">
                <Button type="submit" className="w-full sm:w-auto font-bold px-10 py-6 text-base rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/40 group transition-all duration-300">
                  Send Message
                  <Send className="w-4 h-4 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
              </div>
            </form>
          </div>
          
        </div>
      </div>
    </section>
  );
};

export default Contact;
