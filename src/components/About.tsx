import { Building2, Target, Lightbulb } from "lucide-react";

const About = () => {
  return (
    <section id="about" className="py-32 bg-background relative">
      <div className="container mx-auto px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-tech-label mb-4 block">About Us</span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-tech-heading mb-8">
                Empowering the<br />
                <span className="text-primary">Next Generation</span>
              </h2>
              
              <div className="space-y-6">
                <p className="text-lg text-muted-foreground leading-relaxed">
                  FETUILS TechHub is the first officially recognized technology hub at the University of Ilorin, 
                  established by the Faculty of Engineering and Technology (FET) to bridge the gap between 
                  academic learning and industry-ready skills.
                </p>
                
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Our mission is to provide students with 24/7 access to power, high-speed internet, 
                  and collaborative workspaces, enabling them to learn, build, and innovate without limitations.
                </p>
              </div>
              
              <div className="mt-12 grid grid-cols-2 gap-8">
                <div>
                  <p className="text-4xl font-bold text-primary">2024</p>
                  <p className="text-muted-foreground">Established</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-primary">500+</p>
                  <p className="text-muted-foreground">Students Trained</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="p-8 rounded-2xl bg-card border border-border">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Infrastructure</h3>
                <p className="text-muted-foreground">
                  State-of-the-art facilities with uninterrupted power supply, high-speed internet, 
                  and modern equipment for technical development.
                </p>
              </div>
              
              <div className="p-8 rounded-2xl bg-card border border-border">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Target className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Our Mission</h3>
                <p className="text-muted-foreground">
                  To enhance student employability by providing hands-on technical training 
                  and fostering an innovation ecosystem within the university.
                </p>
              </div>
              
              <div className="p-8 rounded-2xl bg-card border border-border">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Lightbulb className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Innovation Ecosystem</h3>
                <p className="text-muted-foreground">
                  A hub for networking, technical development, and collaboration 
                  bringing together students, faculty, and industry partners.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
