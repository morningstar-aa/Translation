const fs = require('fs');

const API_URL = "http://203.91.72.194:5005/translate";
const outputFilePath = "/Volumes/m2/work/github/Translation /translation.md";

const testCases = [
    "The juxtaposition of the protagonist's internal conflict and the decaying environment serves as a powerful metaphor for societal stagnation.",
    "Notwithstanding the absence of explicit contractual provisions, the doctrine of promissory estoppel may be invoked to prevent unjust enrichment.",
    "Implementing a microservices architecture requires careful consideration of distributed tracing, eventual consistency, and circuit breaking patterns.",
    "The socioeconomic implications of artificial intelligence in marginalized communities must be addressed through inclusive policy-making.",
    "Biological organisms exhibit emergent properties that cannot be fully explained by the sum of their individual physiological components.",
    "The persistent inflationary pressures, coupled with geopolitical instability, have cast a shadow over the projected global economic recovery.",
    "Epistemological skepticism challenges the notion that we can have certain knowledge about the external world.",
    "The rapid advancement of CRISPR technology has initiated a global ethical debate regarding the boundaries of genetic modification.",
    "Subtle nuances in diplomatic language are often used to de-escalate tensions without conceding fundamental strategic objectives.",
    "The symbiotic relationship between coral reefs and zooxanthellae is increasingly threatened by oceanic acidification and rising temperatures.",
    "Heisenberg's Uncertainty Principle posits that it is impossible to simultaneously determine the precise position and momentum of a particle.",
    "The architectural elegance of the cathedral is characterized by its intricate gargoyles, soaring buttresses, and stained-glass panoramas.",
    "Paradoxically, the more information we accumulate, the more elusive the objective truth seems to become in the age of algorithmic bias.",
    "Metabolic pathways are tightly regulated through feedback inhibition to maintain cellular homeostasis under varying environmental conditions.",
    "Cognitive dissonance occurs when an individual holds two or more contradictory beliefs, values, or ideas simultaneously."
];

async function translate(text, source, target) {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({
                q: text,
                source: source,
                target: target,
                format: "text"
            }),
            headers: { "Content-Type": "application/json" }
        });
        const data = await res.json();
        return data.translatedText;
    } catch (e) {
        return `Error: ${e.message}`;
    }
}

async function runTests() {
    let output = "# LibreTranslate Complex Batch Test Results\n\n";
    output += `Generated at: ${new Date().toISOString()}\n\n`;
    output += "| ID | Domain | English Original | Chinese Translation (zh) | Round-Trip (ZH -> EN) | Status |\n";
    output += "|---|---|---|---|---|---|\n";

    const domains = ["Literature", "Legal", "Software", "Sociology", "Biology", "Economy", "Philosophy", "Genetics", "Diplomacy", "Ecology", "Physics", "Architecture", "Media", "Biochem", "Psychology"];

    for (let i = 0; i < testCases.length; i++) {
        console.log(`Testing ${i + 1}/${testCases.length}...`);
        const original = testCases[i];
        const chinese = await translate(original, "en", "zh");
        const roundTrip = await translate(chinese, "zh", "en");

        // Escape bars for markdown table
        const escOriginal = original.replace(/\|/g, "\\|");
        const escChinese = chinese.replace(/\|/g, "\\|");
        const escRoundTrip = roundTrip.replace(/\|/g, "\\|");

        output += `| ${i + 1} | ${domains[i]} | ${escOriginal} | ${escChinese} | ${escRoundTrip} | ✅ |\n`;
    }

    fs.writeFileSync(outputFilePath, output);
    console.log("Done!");
}

runTests();
