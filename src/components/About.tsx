import { Building2, Target, Lightbulb } from "lucide-react";

const About = () => {
  return (
    <section id="about" className="py-24 md:py-32 bg-white relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
            
            
            <div className="relative reveal order-2 lg:order-1 h-full min-h-[400px] lg:min-h-[600px] rounded-[2.5rem] overflow-hidden shadow-2xl group">
              <div className="absolute inset-0 bg-slate-800" /> {/* Fallback color */}
              <img 
                src="/about.jpeg" 
                alt="FETUILS TechHub Workspace" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[#0B1F3F]/10 mix-blend-multiply" />
              
              {/* Decorative Glass Badge on Image */}
              {/* <div className="absolute bottom-6 md:bottom-8 left-6 md:left-8 bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl shadow-xl max-w-xs">
                 <p className="text-white font-bold text-xl leading-tight">
                   Bridging the gap between theory and industry.
                 </p>
              </div> */}
            </div>
            
            {/* Right Side: Text and Features */}
            <div className="reveal-delayed order-1 lg:order-2">
              <span className="text-primary tracking-widest uppercase text-sm font-bold mb-4 block">Our Story</span>
              <h2 className="text-4xl md:text-5xl lg:text-5xl font-extrabold text-[#0B1F3F] leading-[1.1] tracking-tighter mb-8">
                Empowering the<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">Next Generation.</span>
              </h2>
              
              <div className="space-y-6 mb-12">
                <p className="text-lg font-medium text-gray-600 leading-relaxed">
                  FETUILS TechHub is the first officially recognized technology hub at the University of Ilorin, 
                  established by the Faculty of Engineering and Technology (FET).
                </p>
                <p className="text-lg text-gray-500 leading-relaxed font-light">
                  Our mission is to provide students with 24/7 access to power, high-speed internet, 
                  and collaborative workspaces, enabling them to learn, build, and innovate without limitations.
                </p>
              </div>

              {/* Compressed Feature Stack */}
              <div className="space-y-4 relative">
                {/* Stack Item 1 */}
                <div className="group flex items-start gap-5 p-5 bg-slate-50 border border-gray-100/50 rounded-2xl hover:bg-white hover:border-gray-200 hover:shadow-[0_10px_30px_-15px_rgba(11,31,63,0.1)] transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-[#0B1F3F]/5 flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors duration-300">
                    <Building2 className="w-5 h-5 text-[#0B1F3F] group-hover:text-white transition-colors duration-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0B1F3F] mb-1 tracking-tight">Infrastructure</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">State-of-the-art facilities with active power and modern equipment.</p>
                  </div>
                </div>
                
                {/* Stack Item 2 */}
                <div className="group flex items-start gap-5 p-5 bg-slate-50 border border-gray-100/50 rounded-2xl hover:bg-white hover:border-gray-200 hover:shadow-[0_10px_30px_-15px_rgba(11,31,63,0.1)] transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-[#0B1F3F]/5 flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors duration-300">
                    <Target className="w-5 h-5 text-[#0B1F3F] group-hover:text-white transition-colors duration-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0B1F3F] mb-1 tracking-tight">Ecosystem</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">A hub for networking bringing together students and industry.</p>
                  </div>
                </div>
              </div>
              
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
