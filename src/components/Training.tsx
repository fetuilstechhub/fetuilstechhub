import { Code, Cpu, Brain, Globe, Shield, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Training = () => {
  const programs = [
    {
      icon: Code,
      title: "Coding Bootcamp",
      duration: "8 weeks",
      level: "Beginner - Advanced",
      description: "Learn web development, Python, and software engineering fundamentals."
    },
    {
      icon: Palette,
      title: "3D Design Workshop",
      duration: "4 weeks",
      level: "All Levels",
      description: "Master CAD software and 3D modeling for engineering applications."
    },
    {
      icon: Cpu,
      title: "Embedded Systems",
      duration: "6 weeks",
      level: "Intermediate",
      description: "Arduino, Raspberry Pi, and IoT project development."
    },
    {
      icon: Brain,
      title: "AI & Machine Learning",
      duration: "10 weeks",
      level: "Intermediate",
      description: "Hands-on ML projects with Python, TensorFlow, and real datasets."
    },
    {
      icon: Globe,
      title: "Digital Literacy",
      duration: "2 weeks",
      level: "Beginner",
      description: "Google Workspace, productivity tools, and digital skills essentials."
    },
    {
      icon: Shield,
      title: "Research Integrity",
      duration: "1 week",
      level: "All Levels",
      description: "Academic writing, citation practices, and research ethics."
    }
  ];

  return (
    <section className="py-32 bg-muted/30 relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      
      <div className="container mx-auto px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-tech-label mb-4 block">Training Programs</span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-tech-heading mb-6">
              Level Up Your <span className="text-primary">Skills</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Expert-led workshops and training sessions designed to prepare you for the tech industry.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {programs.map((program, index) => (
              <div 
                key={index} 
                className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-500"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <program.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground">
                    {program.duration}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                  {program.title}
                </h3>
                
                <p className="text-sm text-muted-foreground mb-4">
                  {program.description}
                </p>
                
                <span className="text-xs font-medium text-primary">
                  {program.level}
                </span>
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <Button size="lg" className="font-semibold" asChild>
              <Link to="/training">View All Programs</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Training;
