import { Mic, Printer, CuboidIcon as Cube3d, FileText, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Services = () => {
  const services = [
    {
      icon: Cube3d,
      title: "3D Printing Centre",
      description: "Access cutting-edge 3D printing technology for prototyping, model creation, and engineering projects.",
      features: ["FDM & Resin Printing", "Design Consultation", "Rapid Prototyping"]
    },
    {
      icon: Mic,
      title: "Podcast Studio",
      description: "Professional-grade recording studio for podcasts, interviews, and content creation.",
      features: ["Soundproof Room", "Pro Audio Equipment", "Editing Support"]
    },
    {
      icon: FileText,
      title: "FETUILS Print Hub",
      description: "High-quality printing services for academic documents, posters, and project materials.",
      features: ["Large Format Printing", "Binding Services", "Express Printing"]
    },
    {
      icon: Printer,
      title: "Workspace Access",
      description: "24/7 collaborative workspace with reliable power and high-speed internet for focused work.",
      features: ["24/7 Power Supply", "High-Speed WiFi", "Quiet Zones"]
    }
  ];

  return (
    <section id="services" className="py-24 md:py-32 bg-slate-50 relative overflow-hidden">
      <div className="container mx-auto px-6 relative">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 md:mb-20">
            <div className="max-w-2xl reveal">
              <span className="text-primary tracking-widest uppercase text-sm font-bold mb-4 block">Our Services</span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#0B1F3F] leading-tight tracking-tighter">
                Premium facilities for <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">creators & innovators.</span>
              </h2>
            </div>
            <Link 
              to="/services" 
              className="mt-8 md:mt-0 inline-flex items-center text-primary font-bold text-lg hover:text-[#0B1F3F] transition-colors group reveal-delayed"
            >
              Explore all services
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
          
          {/* Elevated Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10">
            {services.map((service, index) => (
              <div 
                key={index} 
                className="group relative flex flex-col p-8 md:p-10 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(11,31,63,0.08)] transition-all duration-500 overflow-hidden reveal-delayed"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Hover Top Border Accent */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-orange-400 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
                
                <div className="w-16 h-16 rounded-2xl bg-[#0B1F3F]/5 flex items-center justify-center mb-8 border border-transparent group-hover:border-primary/20 group-hover:bg-primary/10 transition-colors duration-500 shadow-sm">
                  <service.icon className="w-8 h-8 text-[#0B1F3F] group-hover:text-primary transition-colors duration-500" />
                </div>
                
                <h3 className="text-2xl md:text-3xl font-bold text-[#0B1F3F] mb-4 tracking-tight">
                  {service.title}
                </h3>
                
                <p className="text-gray-600 mb-10 leading-relaxed font-medium text-base md:text-lg">
                  {service.description}
                </p>
                
                {/* Features Pills aligned at the bottom using mt-auto */}
                <div className="flex flex-wrap gap-2 md:gap-3 mt-auto pt-6 border-t border-gray-50 group-hover:border-primary/10 transition-colors duration-500">
                  {service.features.map((feature, idx) => (
                    <span 
                      key={idx}
                      className="px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold rounded-xl bg-slate-50 text-[#0B1F3F]/70 border border-slate-100 group-hover:bg-primary/5 group-hover:text-primary group-hover:border-primary/20 transition-colors duration-500 uppercase tracking-widest"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Services;
