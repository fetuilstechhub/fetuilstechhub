import { Zap, Instagram, Twitter, Linkedin, Youtube } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  const quickLinks = [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
    { label: "Training", href: "/training" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];

  const services = [
    { label: "3D Printing", href: "/services" },
    { label: "Podcast Studio", href: "/services" },
    { label: "Print Hub", href: "/services" },
    { label: "Workspace", href: "/services" },
  ];

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="lg:col-span-1">
              <Link to="/" className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <span className="font-bold text-lg tracking-tight">FETUILS</span>
                  <span className="text-primary font-bold text-lg"> TechHub</span>
                </div>
              </Link>
              <p className="text-muted-foreground text-sm mb-6">
                The first officially recognized technology hub at the University of Ilorin, 
                empowering students with skills for the tech industry.
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <Linkedin className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <Youtube className="w-4 h-4" />
                </a>
              </div>
            </div>
            
            {/* Quick Links */}
            <div>
              <h4 className="font-bold mb-6">Quick Links</h4>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link to={link.href} className="text-muted-foreground hover:text-primary transition-colors text-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Services */}
            <div>
              <h4 className="font-bold mb-6">Services</h4>
              <ul className="space-y-3">
                {services.map((link) => (
                  <li key={link.label}>
                    <Link to={link.href} className="text-muted-foreground hover:text-primary transition-colors text-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Contact */}
            <div>
              <h4 className="font-bold mb-6">Contact</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>Faculty of Engineering & Technology</li>
                <li>University of Ilorin</li>
                <li>Ilorin, Kwara State, Nigeria</li>
                <li className="pt-2">
                  <a href="mailto:fetuils@unilorin.edu.ng" className="hover:text-primary transition-colors">
                    fetuils@unilorin.edu.ng
                  </a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 FETUILS TechHub. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Faculty of Engineering & Technology, University of Ilorin
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
