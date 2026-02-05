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
    <section id="services" className="py-32 bg-background relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-glow opacity-50" />
      
      <div className="container mx-auto px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16">
            <div>
              <span className="text-tech-label mb-4 block">Our Services</span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-tech-heading">
                Facilities &<br />
                <span className="text-primary">Resources</span>
              </h2>
            </div>
            <Link 
              to="/services" 
              className="mt-6 md:mt-0 inline-flex items-center text-primary font-medium hover:underline group"
            >
              View all services
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {services.map((service, index) => (
              <div 
                key={index} 
                className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-500 hover:shadow-glow"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <service.icon className="w-7 h-7 text-primary" />
                </div>
                
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {service.title}
                </h3>
                
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {service.description}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {service.features.map((feature, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground"
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
