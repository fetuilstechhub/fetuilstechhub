import { Button } from "@/components/ui/button";
import { ArrowRight, Wifi, Zap, Users } from "lucide-react";
import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      
      {/* Gradient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-glow" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 reveal">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-primary">First Tech Hub at UNILORIN</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-tech-heading mb-8 reveal">
            Innovate.
            <span className="text-primary"> Build.</span>
            <br />
            Transform.
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 reveal-delayed">
            24/7 power, high-speed internet, and a collaborative workspace for students and innovators at the Faculty of Engineering & Technology.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 reveal-delayed">
            <Button size="lg" className="font-semibold text-lg px-8 group">
              Explore Services
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" className="font-semibold text-lg px-8" asChild>
              <Link to="/training">View Training Programs</Link>
            </Button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto reveal-delayed">
            <div className="text-center">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <p className="text-2xl font-bold">24/7</p>
              <p className="text-sm text-muted-foreground">Power Supply</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Wifi className="w-6 h-6 text-primary" />
              </div>
              <p className="text-2xl font-bold">High-Speed</p>
              <p className="text-sm text-muted-foreground">Internet</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <p className="text-2xl font-bold">500+</p>
              <p className="text-sm text-muted-foreground">Active Members</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
