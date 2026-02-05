import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Code, Cpu, Brain, Globe, Shield, Palette, Clock, Users, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Training = () => {
  const programs = [
    {
      icon: Code,
      title: "Web Development Bootcamp",
      duration: "8 weeks",
      level: "Beginner - Advanced",
      description: "Comprehensive training in HTML, CSS, JavaScript, React, and backend technologies. Build real-world projects.",
      topics: ["HTML/CSS Fundamentals", "JavaScript & React", "Node.js Backend", "Database Management", "Deployment"],
      upcoming: "March 2024"
    },
    {
      icon: Palette,
      title: "3D Design & CAD Workshop",
      duration: "4 weeks",
      level: "All Levels",
      description: "Master 3D modeling software for engineering applications, product design, and architectural visualization.",
      topics: ["CAD Fundamentals", "3D Modeling", "Prototyping", "3D Printing Prep", "Design Best Practices"],
      upcoming: "February 2024"
    },
    {
      icon: Cpu,
      title: "Embedded Systems & IoT",
      duration: "6 weeks",
      level: "Intermediate",
      description: "Hands-on training with Arduino, Raspberry Pi, and IoT project development for real-world applications.",
      topics: ["Microcontroller Basics", "Sensor Integration", "IoT Protocols", "Cloud Connectivity", "Project Development"],
      upcoming: "April 2024"
    },
    {
      icon: Brain,
      title: "AI & Machine Learning",
      duration: "10 weeks",
      level: "Intermediate - Advanced",
      description: "Deep dive into machine learning, neural networks, and AI applications using Python and TensorFlow.",
      topics: ["Python for ML", "Data Processing", "Neural Networks", "Computer Vision", "NLP Basics"],
      upcoming: "March 2024"
    },
    {
      icon: Globe,
      title: "Google Workspace & Digital Skills",
      duration: "2 weeks",
      level: "Beginner",
      description: "Essential digital literacy training covering productivity tools, collaboration, and professional communication.",
      topics: ["Google Docs/Sheets", "Cloud Storage", "Email Best Practices", "Online Collaboration", "Digital Security"],
      upcoming: "Ongoing"
    },
    {
      icon: Shield,
      title: "Research Integrity & Academic Writing",
      duration: "1 week",
      level: "All Levels",
      description: "Master academic writing, proper citation practices, and research ethics for scholarly work.",
      topics: ["Citation Styles", "Plagiarism Prevention", "Research Ethics", "Paper Structure", "Peer Review"],
      upcoming: "Monthly"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <div className="absolute top-1/3 left-0 w-[600px] h-[600px] bg-gradient-glow opacity-40" />
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl">
            <span className="text-tech-label mb-4 block">Training Programs</span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-tech-heading mb-8">
              Learn.<br />
              <span className="text-primary">Build. Grow.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Expert-led workshops and training programs designed to prepare you 
              for success in the tech industry.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-bold text-primary">6+</p>
              <p className="text-muted-foreground">Programs</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-primary">500+</p>
              <p className="text-muted-foreground">Students Trained</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-primary">20+</p>
              <p className="text-muted-foreground">Expert Instructors</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-primary">90%</p>
              <p className="text-muted-foreground">Completion Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* Programs Grid */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              {programs.map((program, index) => (
                <div 
                  key={index}
                  className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-500"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <program.icon className="w-7 h-7 text-primary" />
                    </div>
                    <span className="px-4 py-1.5 text-sm font-medium rounded-full bg-secondary text-secondary-foreground">
                      {program.level}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                    {program.title}
                  </h3>
                  
                  <p className="text-muted-foreground mb-6">
                    {program.description}
                  </p>
                  
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-primary mb-3">Topics Covered</h4>
                    <div className="flex flex-wrap gap-2">
                      {program.topics.map((topic, idx) => (
                        <span 
                          key={idx}
                          className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-6 border-t border-border">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {program.duration}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {program.upcoming}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="group/btn">
                      Learn More
                      <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-muted/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30" />
        <div className="container mx-auto px-6 text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Start <span className="text-primary">Learning?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Enroll in our training programs and gain industry-ready skills. Limited spots available!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="font-semibold" asChild>
              <Link to="/contact">Register Now</Link>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold" asChild>
              <Link to="/services">View Facilities</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Training;
