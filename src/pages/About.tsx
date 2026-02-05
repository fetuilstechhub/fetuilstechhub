import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Building2, Target, Lightbulb, Users, Award, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const About = () => {
  const values = [
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "Fostering creative solutions and cutting-edge technological advancement."
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "Building a community of learners, mentors, and industry partners."
    },
    {
      icon: Award,
      title: "Excellence",
      description: "Striving for the highest standards in training and service delivery."
    }
  ];

  const milestones = [
    { year: "2023", title: "Hub Established", description: "FETUILS TechHub officially recognized by the University" },
    { year: "2023", title: "First Cohort", description: "100+ students enrolled in inaugural training programs" },
    { year: "2024", title: "3D Centre Launch", description: "3D Printing Centre of Excellence opened" },
    { year: "2024", title: "Podcast Studio", description: "Professional recording studio made available" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-glow opacity-40" />
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl">
            <span className="text-tech-label mb-4 block">About Us</span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-tech-heading mb-8">
              Empowering<br />
              <span className="text-primary">Innovation</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              The first officially recognized technology hub at the University of Ilorin, 
              bridging the gap between academic learning and industry-ready skills.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 border-y border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Our <span className="text-primary">Mission</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                FETUILS TechHub was established by the Faculty of Engineering and Technology (FET) 
                at the University of Ilorin to create a conducive environment for learning, 
                innovation, and collaboration.
              </p>
              <p className="text-lg text-muted-foreground mb-8">
                We provide students with 24/7 access to power, high-speed internet, and modern 
                facilities, enabling them to develop practical skills that complement their 
                academic education and prepare them for successful careers in the tech industry.
              </p>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-4xl font-bold text-primary">2023</p>
                  <p className="text-muted-foreground">Year Established</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-primary">500+</p>
                  <p className="text-muted-foreground">Students Impacted</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="p-8 rounded-2xl bg-card border border-border">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Faculty of Engineering & Technology</h3>
                <p className="text-muted-foreground">
                  Officially supported and recognized initiative of FET, University of Ilorin, 
                  providing institutional backing and resources.
                </p>
              </div>
              
              <div className="p-8 rounded-2xl bg-card border border-border">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Target className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Vision</h3>
                <p className="text-muted-foreground">
                  To become a leading innovation hub in Nigeria, producing industry-ready 
                  graduates who drive technological advancement and economic growth.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-tech-label mb-4 block">Our Values</span>
              <h2 className="text-3xl md:text-4xl font-bold">
                What We <span className="text-primary">Stand For</span>
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {values.map((value, index) => (
                <div 
                  key={index}
                  className="text-center p-8 rounded-2xl bg-card border border-border"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <value.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                  <p className="text-muted-foreground">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-tech-label mb-4 block">Our Journey</span>
              <h2 className="text-3xl md:text-4xl font-bold">
                Key <span className="text-primary">Milestones</span>
              </h2>
            </div>
            
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-6 p-6 rounded-2xl bg-card border border-border"
                >
                  <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold">{milestone.year}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">{milestone.title}</h3>
                    <p className="text-muted-foreground">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-8">
            <Zap className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Join the <span className="text-primary">Movement</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Be part of the innovation ecosystem at UNILORIN. Start your journey with FETUILS TechHub today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="font-semibold" asChild>
              <Link to="/contact">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold" asChild>
              <Link to="/services">Explore Services</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
