import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import {
  Check,
  Calendar,
  Briefcase,
  Zap,
  Camera,
  Mic,
  Monitor,
  Printer,
  Users,
  BadgePercent,
  Clock4,
  CuboidIcon as Cube3d,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Pricing = () => {
  const workspacePlans = [
    {
      id: "daily",
      title: "The Daily Pass",
      subtitle: "The 'Quick Grind'",
      description:
        "Perfect for students who just need a few hours of steady power and internet to finish an assignment or join a meeting.",
      price: "₦1,500",
      period: "/ day",
      icon: Zap,
      features: [
        "Access to high-speed Wi-Fi",
        "Guaranteed power & charging ports",
        "Access to the common area",
      ],
      highlight: false,
    },
    {
      id: "weekly",
      title: "The Weekly Plan",
      subtitle: "The 'Project Week'",
      description:
        "Designed for students working on a specific hackathon, a mid-term project, or an intensive study week.",
      price: "₦6,500",
      period: "/ week",
      icon: Calendar,
      features: [
        "All Daily Pass benefits",
        "Save ~₦1,000 compared to daily",
        "Priority seating in the quiet zone",
      ],
      highlight: true,
    },
    {
      id: "monthly",
      title: "Monthly / Semester Plan",
      subtitle: "The 'Power User'",
      description:
        "For serious developers, designers, and students who want the Hub to be their permanent office on campus.",
      price: "₦20,000",
      period: "/ month or bulk deal",
      icon: Briefcase,
      features: [
        "All Daily/Weekly benefits",
        "Personal locker/storage space (if available)",
        "10% discount on Studio/Podcast sessions",
        "10% discount on Hub Merchandise",
      ],
      highlight: false,
    },
  ];

  const specialisedPlans = [
    {
      id: "team_startup",
      title: "The Team/Startup Bundle",
      description:
        "For groups of 3–5 students working together on a startup or a final year project.",
      price: "₦20,000",
      period: "per month / team",
      icon: Users,
      features: ["Dedicated table/area for the team to collaborate"],
      ctaLabel: "Book Team Bundle",
      ctaTo: "/booking?plan=monthly",
    },
    {
      id: "fet_discount",
      title: "Faculty of Engineering (FET) Discount",
      description:
        "To foster our own ecosystem first. Available for all valid FET students.",
      price: "10% OFF",
      period: "any plan",
      icon: BadgePercent,
      features: ["Requires presentation of a valid Faculty ID card"],
      ctaLabel: "Claim Discount",
      ctaTo: "/booking?plan=daily",
    },
  ];

  const rentalServices = [
    {
      category: "Studio & Media Services",
      description:
        "Professional tools for creators, podcasters, and campus influencers.",
      items: [
        {
          id: "studio_standard",
          title: "Standard Studio Session",
          price: "₦5,000",
          period: "up to 90 mins",
          icon: Mic,
          features: [
            "Up to 90 minutes of dedicated studio time",
            "Use of professional microphones and audio mixers",
            "High-end studio lighting setup",
            "Assistance from a Studio Team member",
          ],
        },
        {
          id: "photoshoot",
          title: "Professional Photoshoot",
          price: "₦3,000",
          period: "base session",
          icon: Camera,
          features: [
            "Access to the studio's photography backdrop and lighting",
            "Base session for personal branding or project documentation",
            "Use of the Hub's professional camera (if available)",
          ],
        },
      ],
    },
    {
      category: "Equipment Rentage",
      description: "Premium gear for your external events and projects.",
      items: [
        {
          id: "visual_kit",
          title: "Visual & Presentation Kit",
          price: "Starting at ₦5,000",
          period: "per day",
          icon: Monitor,
          features: [
            "Use of professional Camera bodies, Lenses, Sound System or Projectors",
            "Perfect for external seminars, faculty events, or personal shoots",
            "Gear testing and setup orientation from our Technical Team",
          ],
        },
        {
          id: "audio_lighting",
          title: "Audio & Lighting Kit",
          price: "₦2,000 – ₦3,000",
          period: "per day",
          icon: Zap,
          features: [
            "Access to wireless mics, soft boxes, or ring lights",
            "Lightweight and portable for on-the-go content creation",
          ],
        },
      ],
    },
    {
      category: "Custom Production",
      description:
        "Tailored solutions for your physical and digital builds.",
      items: [
        {
          id: "branding_print",
          title: "Branding & Printing Section",
          price: "Custom Quote",
          period: "based on requirements",
          icon: Printer,
          features: [
            "High-quality heat-press designs on T-shirts, hoodies, and caps",
            "Professional branding for mugs and souvenirs",
            "Design review by our internal Design Team",
          ],
        },
        {
          id: "prototype_3d",
          title: "3D Printing & Prototyping",
          price: "Custom Quote",
          period: "based on specifications",
          icon: Cube3d,
          features: [
            "Precision 3D printing for engineering parts and project models",
            "Technical assessment of your STL files to ensure structural integrity",
            "Choice of filament types based on your project requirements",
          ],
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-gradient-glow opacity-40" />

        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <span className="text-tech-label mb-4 block">Pricing & Plans</span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-tech-heading mb-8">
              Flexible Plans for <br />
              <span className="text-primary">Every Creator</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Whether you need a quick study session or a permanent workspace
              for your startup, we have a plan tailored for your success.
            </p>
            <div className="inline-flex items-center gap-3 bg-card border border-border px-6 py-3 rounded-full text-foreground shadow-sm">
              <Clock4 className="text-primary w-5 h-5" />
              <span className="font-medium">
                Operating Hours: 9 AM – 6 PM (Mon - Fri)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Workspace Pricing */}
      <section className="py-24 border-y border-border relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Workspace Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Choose the perfect pass for your work style.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {workspacePlans.map((plan, index) => (
              <div
                key={index}
                className={`relative p-8 rounded-3xl border transition-all duration-500 flex flex-col ${
                  plan.highlight
                    ? "bg-gradient-accent border-primary shadow-glow transform md:-translate-y-4"
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
                    Most Popular
                  </div>
                )}

                <div className="mb-8">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${
                      plan.highlight ? "bg-primary/20" : "bg-primary/10"
                    }`}
                  >
                    <plan.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-1">{plan.title}</h3>
                  <p className="text-primary font-medium mb-4">
                    {plan.subtitle}
                  </p>
                  <p className="text-muted-foreground text-sm h-16">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-8">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-2">
                    {plan.period}
                  </span>
                </div>

                <ul className="space-y-4 mb-8 flex-grow">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <Check className="w-5 h-5 text-primary shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                >
                  <Link to={`/booking?plan=${plan.id}`}>Choose Plan</Link>
                </Button>
              </div>
            ))}
          </div>

          {/* Specialised Plans */}
          <div className="mt-16 grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {specialisedPlans.map((plan, index) => (
              <div
                key={index}
                className="bg-card/50 border border-border rounded-2xl p-6 flex items-start gap-6 hover:border-primary/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <plan.icon className="w-6 h-6 text-primary" />
                </div>

                <div>
                  <h4 className="text-xl font-bold mb-2">{plan.title}</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    {plan.description}
                  </p>

                  <div className="flex items-end gap-2 mb-4">
                    <span className="text-2xl font-bold text-primary">
                      {plan.price}
                    </span>
                    <span className="text-sm text-muted-foreground pb-1">
                      {plan.period}
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button asChild className="mt-5 w-full" variant="outline">
                    <Link to={plan.ctaTo}>{plan.ctaLabel}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services & Rentals */}
      <section className="py-24 bg-muted/20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Services & Rentals
            </h2>
            <p className="text-lg text-muted-foreground">
              High-end equipment and services to power your projects.
            </p>
          </div>

          <div className="space-y-16 max-w-7xl mx-auto">
            {rentalServices.map((section, idx) => (
              <div key={idx} className="space-y-8">
                <div>
                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                    <div className="w-2 h-8 bg-primary rounded-full"></div>
                    {section.category}
                  </h3>
                  <p className="text-muted-foreground ml-5">
                    {section.description}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 ml-5">
                  {section.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="bg-card border border-border p-8 rounded-3xl hover:border-primary/30 transition-all"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <item.icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{item.price}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.period}
                          </div>
                        </div>
                      </div>

                      <h4 className="text-xl font-bold mb-6">{item.title}</h4>

                      <ul className="space-y-3">
                        {item.features.map((feature, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-3">
                            <Check className="w-4 h-4 text-primary mt-1 shrink-0" />
                            <span className="text-sm text-muted-foreground">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-8">
                        {item.id === "studio_standard" ||
                        item.id === "photoshoot" ? (
                          <Button asChild className="w-full">
                            <Link to={`/booking?plan=${item.id}`}>
                              Book This Service
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild variant="outline" className="w-full">
                            <Link to="/contact">Get a Custom Quote</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Need a <span className="text-primary">Custom Solution?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Can't find exactly what you're looking for? Reach out to our team,
            and we'll craft a plan that works for you.
          </p>

          <Button size="lg" className="font-semibold" asChild>
            <Link to="/contact">Contact Our Sales Team</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;