import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isHomeTop = location.pathname === "/" && !isScrolled;

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services" },
    { href: "/training", label: "Training" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
      isHomeTop 
        ? "bg-transparent border-transparent text-white py-2" 
        : "bg-background/90 backdrop-blur-xl border-border py-0"
    }`}>
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img 
            src="/logo.png" 
            alt="FETUILS TechHub Logo" 
            className="h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
          />
          {/* <div className="hidden sm:block">
            <span className="font-bold text-lg tracking-tight">FETUILS</span>
            <span className="text-primary font-bold text-lg"> TechHub</span>
          </div> */}
        </Link>
        
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`relative py-1 text-sm font-medium transition-colors duration-300 ${
                isActive(link.href) 
                  ? "text-primary" 
                  : isHomeTop
                    ? "text-gray-300 hover:text-white"
                    : "text-muted-foreground hover:text-foreground"
              } before:absolute before:inset-x-0 before:bottom-0 before:h-[2px] before:bg-primary before:transition-transform before:duration-300 ${
                isActive(link.href) ? "before:scale-x-100" : "before:scale-x-0 group-hover:before:scale-x-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Button onClick={() => window.open("https://chat.whatsapp.com/Faz6HL6rO7XBqPNMtxNbWa?mode=gi_t", "_blank")} variant="default" size="sm" className="font-semibold shadow-glow hover:shadow-none transition-shadow duration-300">
            Join Hub
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={`md:hidden ${isHomeTop ? "text-white hover:bg-white/20" : ""}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-background border-b border-border text-foreground absolute top-full left-0 right-0 shadow-lg">
          <div className="container mx-auto px-6 py-6 space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`block text-sm font-medium transition-colors duration-300 ${
                  isActive(link.href) 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-border">
              <Button variant="default" size="sm" className="w-full font-semibold">
                Join Hub
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
