import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wifi, Zap, Users } from "lucide-react";
import { Link } from "react-router-dom";

const heroImages = [
  "/hero-1.jpeg", // Placeholder for actual hub image 1
  "/hero-2.jpeg", // Placeholder for actual hub image 2
  "/hero-3.jpeg", // Placeholder for actual hub image 3
];

const Hero = () => {
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length);
    }, 5000); // Change image every 5 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image Slider */}
      {heroImages.map((src, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === currentImage ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* We use a solid slate background color as a fallback while the image loads or if it's missing */}
          <div className="absolute inset-0 bg-slate-800" />
          <img
            src={src}
            alt={`Hero Slide ${index + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      ))}
      
      {/* Deep Dark Blue Overlay to make text pop */}
      <div className="absolute inset-0 bg-[#0B1F3F]/75 mix-blend-multiply" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3F] via-transparent to-transparent opacity-80" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 pt-24 pb-16 md:pb-28">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6 md:mb-8 reveal shadow-lg">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs sm:text-sm font-medium text-white shadow-sm">First Tech Hub at UNILORIN</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extrabold text-white mb-6 md:mb-8 reveal drop-shadow-2xl overflow-hidden leading-[1.1] tracking-tighter uppercase">
            Innovate.<br />
            <span className="text-primary tracking-tighter drop-shadow-[0_0_15px_rgba(240,74,31,0.5)]">Build. </span>
            Transform.
          </h1>
          
          <p className="text-lg md:text-xl lg:text-2xl text-gray-200 max-w-3xl mx-auto mb-12 reveal-delayed drop-shadow-md font-light leading-relaxed">
            24/7 power, high-speed internet, and a collaborative workspace for students and innovators at the Faculty of Engineering & Technology.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 md:mb-16 reveal-delayed">
            <Button size="lg" className="w-full sm:w-auto font-semibold text-lg px-8 group shadow-glow hover:shadow-none transition-all duration-300">
              Explore Services
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto font-semibold text-lg px-8 bg-transparent text-white border-white hover:bg-white hover:text-[#0B1F3F] transition-all duration-300" asChild>
              <Link to="/training">View Training Programs</Link>
            </Button>
          </div>
          
          {/* Redesigned Minimal Stats Row */}
          <div className="flex justify-center md:items-center gap-4 sm:gap-8 md:gap-16 pt-8 md:pt-10 border-t border-white/10 reveal-delayed w-full">
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 group flex-1 md:flex-none">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors shadow-sm">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="text-center md:text-left">
                <p className="text-lg md:text-xl font-bold text-white leading-none tracking-tight">24/7</p>
                <p className="text-[9px] md:text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1 md:mt-1.5 whitespace-nowrap">Power Supply</p>
              </div>
            </div>
            
            <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 group flex-1 md:flex-none">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors shadow-sm">
                <Wifi className="w-5 h-5 text-primary" />
              </div>
              <div className="text-center md:text-left">
                <p className="text-lg md:text-xl font-bold text-white leading-none tracking-tight">Gigabit</p>
                <p className="text-[9px] md:text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1 md:mt-1.5 whitespace-nowrap">Internet</p>
              </div>
            </div>

            <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent" />

            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 group flex-1 md:flex-none">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors shadow-sm">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="text-center md:text-left">
                <p className="text-lg md:text-xl font-bold text-white leading-none tracking-tight">500+</p>
                <p className="text-[9px] md:text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1 md:mt-1.5 whitespace-nowrap">Members</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
