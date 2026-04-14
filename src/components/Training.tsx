import { Code, Cpu, Brain, Globe, Shield, Palette, ArrowRight } from "lucide-react";
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
    <section id="training" className="py-24 md:py-32 bg-white relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 md:mb-20">
            <div className="max-w-2xl reveal">
              <span className="text-primary tracking-widest uppercase text-sm font-bold mb-4 block">Training Programs</span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#0B1F3F] leading-[1.1] tracking-tighter">
                Level up your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">technical skills.</span>
              </h2>
            </div>
            
            <p className="text-lg md:text-xl text-gray-500 max-w-sm mt-6 md:mt-0 reveal-delayed leading-relaxed">
              Expert-led workshops and immersive sprints designed to prepare you for the tech industry.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-16">
            {programs.map((program, index) => (
              <div 
                key={index} 
                className="group flex flex-col p-8 md:p-10 bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_-15px_rgba(11,31,63,0.1)] transition-all duration-500 hover:-translate-y-2 reveal-delayed"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-[#0B1F3F]/5 flex items-center justify-center border border-transparent group-hover:border-primary/20 group-hover:bg-primary/10 transition-colors duration-500">
                    <program.icon className="w-7 h-7 text-[#0B1F3F] group-hover:text-primary transition-colors duration-500" />
                  </div>
                  <span className="px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-full bg-slate-50 border border-slate-100 text-gray-500 group-hover:bg-primary/5 group-hover:border-primary/20 group-hover:text-primary transition-colors duration-500 uppercase tracking-widest">
                    {program.duration}
                  </span>
                </div>
                
                <h3 className="text-xl md:text-2xl font-bold text-[#0B1F3F] mb-4 tracking-tight">
                  {program.title}
                </h3>
                
                <p className="text-gray-500 mb-8 leading-relaxed font-medium">
                  {program.description}
                </p>
                
                <div className="mt-auto pt-6 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0B1F3F]/60 uppercase tracking-widest">
                    {program.level}
                  </span>
                  
                  {/* Small arrow that appears on hover indicating action */}
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    <ArrowRight className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center md:text-left reveal-delayed">
            <Link 
              to="/training" 
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[#0B1F3F] text-white font-semibold hover:bg-primary hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 group"
            >
              View Full Curriculum
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Training;
