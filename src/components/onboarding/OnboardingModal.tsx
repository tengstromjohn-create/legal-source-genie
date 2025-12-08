import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, MessageSquare, CheckCircle2 } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  onLoadDemo: () => void;
}

const steps = [
  {
    icon: FileText,
    title: "1. Lägg till en källa",
    description:
      "Börja med att lägga till en rättskälla – det kan vara en lag, förarbete, dom eller annan juridisk text. Du kan klistra in text manuellt, ladda upp en PDF eller importera från Riksdagen.",
  },
  {
    icon: Sparkles,
    title: "2. Generera krav",
    description:
      "När du lagt till en källa kan AI:n analysera texten och automatiskt extrahera juridiska krav, skyldigheter och åtgärder som din klient behöver följa.",
  },
  {
    icon: MessageSquare,
    title: "3. Ställ en fråga",
    description:
      "Använd AI-chatten för att ställa frågor om dina rättskällor. AI:n söker igenom alla dina källor och ger svar med hänvisningar till relevant lagrum.",
  },
];

export function OnboardingModal({ open, onComplete, onLoadDemo }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLoadDemo = () => {
    onLoadDemo();
    onComplete();
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">Välkommen till Legal Source Genie!</DialogTitle>
          <DialogDescription>
            Låt oss visa dig hur du kommer igång på tre enkla steg.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-8 rounded-full transition-colors ${
                  index === currentStep
                    ? "bg-primary"
                    : index < currentStep
                    ? "bg-primary/50"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Current step content */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed px-4">
              {step.description}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0}>
              Tillbaka
            </Button>
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Kom igång
                </>
              ) : (
                "Nästa"
              )}
            </Button>
          </div>
          
          {currentStep === steps.length - 1 && (
            <Button variant="secondary" onClick={handleLoadDemo}>
              <Sparkles className="mr-2 h-4 w-4" />
              Ladda demo-data
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
