import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Shield,
  Clock,
  Heart,
  CheckCircle,
  MessageCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const features = [
    {
      icon: Users,
      title: "Médicos Habilitados",
      description: "CRM ativo verificado",
    },
    {
      icon: Shield,
      title: "Dados Protegidos",
      description: "Criptografia AES-256",
    },
    {
      icon: Clock,
      title: "Atendimento Rápido",
      description: "Resposta em até 24h",
    },
    {
      icon: Heart,
      title: "Cuidado Contínuo",
      description: "Acompanhamento médico",
    },
  ];

  const slides = [
    {
      number: 1,
      title: "Solicite seu atendimento",
      description: "Preencha um formulário rápido com seus dados básicos",
    },
    {
      number: 2,
      title: "Avaliação médica",
      description: "Um médico habilitado avalia seu caso em até 24h",
    },
    {
      number: 3,
      title: "Receita digital",
      description: "Receba sua receita de forma segura e rápida",
    },
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 leading-none">Dr.</p>
              <p className="text-lg font-bold text-gray-900 leading-none">Prescreve</p>
            </div>
          </div>

          <Button
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full px-6 font-semibold shadow-lg transition-all"
            size="sm"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Solicitar Atendimento
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-12">
        <div className="flex justify-center">
          <Badge className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium border-none">
            <CheckCircle className="w-4 h-4 mr-2" />
            Médicos com CRM ativo
          </Badge>
        </div>

        {/* Hero Section */}
        <section className="text-center space-y-6 py-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
            Renovação de receitas{" "}
            <span className="text-blue-600">sem burocracia</span>
          </h1>

          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Avaliação médica assíncrona, rápida e segura. Mantenha seu
            tratamento em dia com praticidade e responsabilidade médica.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full px-8 py-6 font-semibold text-lg shadow-lg transition-all"
              size="lg"
            >
              Solicitar Atendimento
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <Button
              variant="outline"
              className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-full px-8 py-6 font-semibold text-lg"
              size="lg"
            >
              Como Funciona
            </Button>
          </div>
        </section>

        {/* Trust Indicators */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 rounded-2xl p-6">
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <Shield className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-gray-900">LGPD Compliant</p>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-center md:justify-start">
            <Clock className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-gray-900">Resposta em até 24h</p>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Por que escolher Doctor Prescreve?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="bg-white border border-gray-200 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <Icon className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* How It Works Carousel */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center">
            Como Funciona
          </h2>

          <div className="relative bg-white rounded-2xl p-8 shadow-lg max-w-2xl mx-auto">
            <div className="text-center space-y-4 min-h-[160px] flex flex-col justify-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-full font-bold mx-auto">
                {slides[currentSlide].number}
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                {slides[currentSlide].title}
              </h3>
              <p className="text-gray-600 max-w-sm mx-auto">
                {slides[currentSlide].description}
              </p>
            </div>

            <div className="flex items-center justify-between mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={prevSlide}
                className="rounded-full border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <div className="flex gap-2">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentSlide ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={nextSlide}
                className="rounded-full border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-center text-white space-y-4">
          <h2 className="text-2xl font-bold">Pronto para começar?</h2>
          <p className="text-blue-100 max-w-md mx-auto">
            Solicite seu atendimento agora e receba uma avaliação médica em até 24 horas.
          </p>
          <Button
            className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-3 rounded-full"
            size="lg"
          >
            Solicitar Atendimento Agora
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm space-y-4">
          <p className="text-white font-semibold">Doctor Prescreve</p>
          <p>© 2026 Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}