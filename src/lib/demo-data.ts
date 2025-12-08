/**
 * Demo data for onboarding new users
 * Contains fictional but realistic legal sources and requirements
 */

export const DEMO_WORKSPACE_NAME = "Demo: M&A & GDPR-case";

export interface DemoLegalSource {
  title: string;
  content: string;
  regelverkName: string;
  lagrum: string;
  typ: string;
  referens?: string;
}

export interface DemoRequirement {
  title: string;
  titel: string;
  beskrivning: string;
  obligation: string;
  risknivå: string;
  subjekt: string[];
  trigger: string[];
  åtgärder: string[];
  undantag: string[];
}

// M&A Case - Fictional acquisition scenario
const maaSources: DemoLegalSource[] = [
  {
    title: "ABL 23 kap - Fusion",
    content: `23 kap. Fusion

1 § En fusion innebär att ett eller flera aktiebolags samtliga tillgångar och skulder övertas av ett annat aktiebolag mot vederlag till aktieägarna i det eller de överlåtande bolagen i form av aktier i det övertagande bolaget.

Vid en fusion upplöses det eller de överlåtande bolagen utan likvidation.

2 § En fusion får ske genom absorption eller genom kombination.

Vid absorption övertar ett aktiebolag (övertagande bolag) ett eller flera andra aktiebolag (överlåtande bolag).

Vid kombination överlåter två eller flera aktiebolag (överlåtande bolag) sina tillgångar och skulder till ett nybildat aktiebolag (övertagande bolag).

14 § Inom en månad från det att fusionsplanen har registrerats ska det övertagande bolaget ansöka om tillstånd att verkställa fusionsplanen.

15 § Tillstånd att verkställa fusionsplanen ska vägras om det finns skäl att anta att fusionen kommer att skada borgenärerna i något av de bolag som deltar i fusionen.`,
    regelverkName: "Aktiebolagslagen (2005:551)",
    lagrum: "23 kap. 1-2, 14-15 §§",
    typ: "lag",
    referens: "SFS 2005:551",
  },
  {
    title: "LAS - Övergång av verksamhet",
    content: `6 b § Vid övergång av ett företag, en verksamhet eller en del av en verksamhet från en arbetsgivare till en annan, övergår också de rättigheter och skyldigheter på grund av de anställningsavtal och de anställningsförhållanden som gäller vid tidpunkten för övergången på den nya arbetsgivaren.

Den tidigare arbetsgivaren är dock också ansvarig gentemot arbetstagaren för ekonomiska förpliktelser som hänför sig till tiden före övergången.

Första stycket gäller inte vid övergång i samband med konkurs.

Arbetstagare som motsätter sig en övergång av anställningsavtalet har rätt att stanna kvar hos den överlåtande arbetsgivaren.

7 § Vid övergång enligt 6 b § får arbetstagare inte sägas upp eller avskedas enbart på grund av övergången. En uppsägning eller ett avskedande som sker i strid med detta är ogiltigt.`,
    regelverkName: "Lagen om anställningsskydd (1982:80)",
    lagrum: "6 b-7 §§",
    typ: "lag",
    referens: "SFS 1982:80",
  },
];

// GDPR Case - Data protection requirements
const gdprSources: DemoLegalSource[] = [
  {
    title: "GDPR Art. 13-14 - Informationsskyldighet",
    content: `Artikel 13 - Information som ska tillhandahållas om personuppgifter samlas in från den registrerade

1. Om personuppgifter som rör en registrerad person samlas in från den registrerade ska den personuppgiftsansvarige, vid den tidpunkt då personuppgifterna erhålls, förse den registrerade med följande information:
a) Den personuppgiftsansvariges identitet och kontaktuppgifter.
b) Kontaktuppgifterna för dataskyddsombudet, i tillämpliga fall.
c) Ändamålen med den behandling för vilken personuppgifterna är avsedda samt den rättsliga grunden för behandlingen.
d) Om behandlingen är nödvändig för ändamål som rör den personuppgiftsansvariges berättigade intressen: de berättigade intressen som den personuppgiftsansvarige eller en tredje part eftersträvar.
e) Mottagarna eller de kategorier av mottagare som ska ta del av personuppgifterna.
f) I tillämpliga fall: uppgift om att den personuppgiftsansvarige avser att överföra personuppgifter till ett tredjeland.

2. Utöver den information som avses i punkt 1 ska den personuppgiftsansvarige vid den tidpunkt då personuppgifterna erhålls förse den registrerade med följande ytterligare information:
a) Den period under vilken personuppgifterna kommer att lagras.
b) Förekomsten av rätten att av den personuppgiftsansvarige begära tillgång till och rättelse eller radering av personuppgifter.
c) Rätten att när som helst återkalla samtycke.`,
    regelverkName: "Dataskyddsförordningen (GDPR)",
    lagrum: "Art. 13-14",
    typ: "eu-förordning",
    referens: "EU 2016/679",
  },
  {
    title: "GDPR Art. 28 - Personuppgiftsbiträdesavtal",
    content: `Artikel 28 - Personuppgiftsbiträde

1. Om en behandling ska genomföras på en personuppgiftsansvarigs vägnar, ska den personuppgiftsansvarige endast anlita personuppgiftsbiträden som ger tillräckliga garantier för att genomföra lämpliga tekniska och organisatoriska åtgärder.

3. Behandling genom ett personuppgiftsbiträde ska regleras genom ett avtal eller en annan rättsakt som är bindande och som:
a) Anger föremålet för och varaktigheten av behandlingen, behandlingens art och ändamål, typen av personuppgifter och kategorier av registrerade samt den personuppgiftsansvariges skyldigheter och rättigheter.
b) Innehåller krav på att personuppgiftsbiträdet endast behandlar personuppgifter på dokumenterade instruktioner från den personuppgiftsansvarige.
c) Säkerställer att personer med befogenhet att behandla personuppgifter har åtagit sig att iaktta tystnadsplikt.
d) Kräver att biträdet bistår den personuppgiftsansvarige vid tillsynsmyndighetens granskningar.`,
    regelverkName: "Dataskyddsförordningen (GDPR)",
    lagrum: "Art. 28",
    typ: "eu-förordning",
    referens: "EU 2016/679",
  },
  {
    title: "GDPR Art. 33-34 - Incidentrapportering",
    content: `Artikel 33 - Anmälan av en personuppgiftsincident till tillsynsmyndigheten

1. Vid en personuppgiftsincident ska den personuppgiftsansvarige utan onödigt dröjsmål och, om så är möjligt, inte senare än 72 timmar efter att ha fått vetskap om den, anmäla personuppgiftsincidenten till tillsynsmyndigheten, om det inte är osannolikt att personuppgiftsincidenten medför en risk för fysiska personers rättigheter och friheter.

2. Personuppgiftsbiträdet ska underrätta den personuppgiftsansvarige utan onödigt dröjsmål efter att ha fått vetskap om en personuppgiftsincident.

Artikel 34 - Information till den registrerade om en personuppgiftsincident

1. Om personuppgiftsincidenten sannolikt leder till en hög risk för fysiska personers rättigheter och friheter ska den personuppgiftsansvarige utan onödigt dröjsmål informera den registrerade om personuppgiftsincidenten.

2. Den information till den registrerade som avses i punkt 1 ska innehålla en tydlig beskrivning av personuppgiftsincidentens art och åtminstone de uppgifter som anges i artikel 33.3 b, c och d.`,
    regelverkName: "Dataskyddsförordningen (GDPR)",
    lagrum: "Art. 33-34",
    typ: "eu-förordning",
    referens: "EU 2016/679",
  },
];

export const DEMO_LEGAL_SOURCES: DemoLegalSource[] = [...maaSources, ...gdprSources];

// Requirements derived from the demo sources
export const DEMO_REQUIREMENTS: (DemoRequirement & { sourceIndex: number })[] = [
  // M&A requirements
  {
    sourceIndex: 0,
    title: "Fusionsplan måste registreras",
    titel: "Fusionsplan måste registreras",
    beskrivning: "Vid fusion ska en fusionsplan upprättas och registreras hos Bolagsverket innan ansökan om tillstånd görs.",
    obligation: "ska upprätta och registrera fusionsplan",
    risknivå: "hög",
    subjekt: ["Övertagande bolag", "Överlåtande bolag"],
    trigger: ["Vid planerad fusion"],
    åtgärder: [
      "Upprätta fusionsplan enligt ABL 23 kap.",
      "Registrera fusionsplan hos Bolagsverket",
      "Ansök om tillstånd inom en månad från registrering",
    ],
    undantag: [],
  },
  {
    sourceIndex: 1,
    title: "Informera arbetstagare vid verksamhetsövergång",
    titel: "Informera arbetstagare vid verksamhetsövergång",
    beskrivning: "Arbetstagare vars anställning övergår till ny arbetsgivare måste informeras om sina rättigheter.",
    obligation: "ska informera arbetstagare om rättigheter vid övergång",
    risknivå: "medel",
    subjekt: ["Överlåtande arbetsgivare", "Övertagande arbetsgivare"],
    trigger: ["Vid övergång av verksamhet", "Före genomförande av transaktion"],
    åtgärder: [
      "Identifiera berörda arbetstagare",
      "Informera om att anställningsavtal övergår",
      "Informera om rätten att motsätta sig övergång",
    ],
    undantag: ["Gäller ej vid konkurs"],
  },
  // GDPR requirements
  {
    sourceIndex: 2,
    title: "Informera registrerade vid insamling",
    titel: "Informera registrerade vid insamling",
    beskrivning: "När personuppgifter samlas in ska den registrerade informeras om hur uppgifterna kommer att behandlas.",
    obligation: "ska informera registrerade vid insamling av personuppgifter",
    risknivå: "hög",
    subjekt: ["Personuppgiftsansvarig"],
    trigger: ["Vid insamling av personuppgifter från registrerad"],
    åtgärder: [
      "Informera om personuppgiftsansvarigs identitet",
      "Ange ändamål och rättslig grund",
      "Informera om lagringstid och rättigheter",
      "Upplysa om rätt att återkalla samtycke",
    ],
    undantag: ["Om den registrerade redan har informationen"],
  },
  {
    sourceIndex: 3,
    title: "Upprätta personuppgiftsbiträdesavtal",
    titel: "Upprätta personuppgiftsbiträdesavtal",
    beskrivning: "Avtal måste upprättas med varje personuppgiftsbiträde som behandlar personuppgifter.",
    obligation: "ska upprätta skriftligt personuppgiftsbiträdesavtal",
    risknivå: "hög",
    subjekt: ["Personuppgiftsansvarig"],
    trigger: ["Innan personuppgiftsbiträde anlitas"],
    åtgärder: [
      "Verifiera biträdets garantier och säkerhetsåtgärder",
      "Upprätta avtal med obligatoriska klausuler enligt Art. 28.3",
      "Dokumentera instruktioner för behandling",
    ],
    undantag: [],
  },
  {
    sourceIndex: 4,
    title: "Anmäl personuppgiftsincident inom 72 timmar",
    titel: "Anmäl personuppgiftsincident inom 72 timmar",
    beskrivning: "Personuppgiftsincidenter ska anmälas till Integritetsskyddsmyndigheten inom 72 timmar.",
    obligation: "ska anmäla personuppgiftsincident till tillsynsmyndighet",
    risknivå: "kritisk",
    subjekt: ["Personuppgiftsansvarig"],
    trigger: ["Vid upptäckt personuppgiftsincident"],
    åtgärder: [
      "Dokumentera incidenten internt",
      "Bedöm risk för registrerades rättigheter",
      "Anmäl till IMY inom 72 timmar om risk föreligger",
      "Informera registrerade vid hög risk",
    ],
    undantag: ["Om incident osannolikt medför risk för registrerades rättigheter"],
  },
];
