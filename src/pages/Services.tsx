import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Mic, Printer, CuboidIcon as Cube3d, FileText, Zap, Wifi, Monitor, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Services = () => {
  const mainServices = [
    {
      icon: Cube3d,
      title: "3D Printing Centre of Excellence",
      description: "Our state-of-the-art 3D printing facility offers FDM and resin printing capabilities for engineering prototypes, architectural models, and creative projects.",
      features: [
        "FDM & SLA/Resin Printing",
        "Design consultation & optimization",
        "Rapid prototyping services",
        "Material selection guidance",
        "Post-processing & finishing"
      ],
      highlight: true
    },
    {
      icon: Mic,
      title: "Podcast Studio",
      description: "Professional recording studio equipped with industry-standard audio equipment for podcasts, interviews, voice-overs, and content creation.",
      features: [
        "Soundproof recording room",
        "Professional microphones & mixers",
        "Audio editing workstation",
        "Video recording capability",
        "Technical support available"
      ],
      highlight: false
    },
    {
      icon: FileText,
      title: "FETUILS Print Hub",
      description: "Comprehensive printing services for all your academic and professional needs, from documents to large-format posters.",
      features: [
        "Document printing & copying",
        "Large format poster printing",
        "Binding & lamination",
        "Express printing services",
        "Bulk printing discounts"
      ],
      highlight: false
    },
    {
      icon: Monitor,
      title: "Collaborative Workspace",
      description: "24/7 access to a dedicated workspace with reliable infrastructure for studying, coding, and team collaboration.",
      features: [
        "24/7 power supply",
        "High-speed internet access",
        "Individual & group workstations",
        "Quiet zones available",
        "Locker storage"
      ],
      highlight: true
    }
  ];

  const infrastructure = [
    { icon: Zap, label: "24/7 Power", desc: "Uninterrupted power supply" },
    { icon: Wifi, label: "High-Speed Internet", desc: "Reliable connectivity" },
    { icon: Users, label: "Collaboration Spaces", desc: "Team meeting areas" },
    { icon: Monitor, label: "Workstations", desc: "Modern equipment" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-gradient-glow opacity-40" />
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl">
            <span className="text-tech-label mb-4 block">Our Services</span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-tech-heading mb-8">
              World-Class<br />
              <span className="text-primary">Facilities</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Access cutting-edge technology, professional studios, and collaborative spaces 
              designed to support your innovation journey.
            </p>
          </div>
        </div>
      </section>

      {/* Infrastructure Stats */}
      <section className="py-12 border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {infrastructure.map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold mb-1">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Services */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-7xl mx-auto space-y-8">
            {mainServices.map((service, index) => (
              <div 
                key={index}
                className={`p-8 md:p-12 rounded-3xl border transition-all duration-500 ${
                  service.highlight 
                    ? "bg-gradient-accent border-primary/30" 
                    : "bg-card border-border"
                }`}
              >
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                      <service.icon className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                      {service.title}
                    </h2>
                    <p className="text-lg text-muted-foreground">
                      {service.description}
                    </p>
                  </div>
                  
                  <div className="bg-background/50 rounded-2xl p-6">
                    <h4 className="font-semibold mb-4 text-primary">What's Included</h4>
                    <ul className="space-y-3">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Get <span className="text-primary">Started?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Join hundreds of students already using our facilities to build their future.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="font-semibold" asChild>
              <Link to="/contact">Contact Us</Link>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold" asChild>
              <Link to="/training">View Training Programs</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Services;
