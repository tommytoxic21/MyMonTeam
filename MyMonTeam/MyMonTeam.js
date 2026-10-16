
const team = document.getElementById("team");
const searchInput = document.getElementById("pokemon-search");
const searchResults = document.getElementById("search-results");

let allPokemon = [];

// Create the six empty team slots
for (let slot = 1; slot <= 6; slot += 1) {
    const card = document.createElement("article");
    card.className = "mon-card";
    card.setAttribute("aria-label", `Slot ${slot}`);
    team.appendChild(card);
}

// Load Pokémon from PokéAPI
async function loadPokemon() {
    try {
        const response = await fetch(
            "https://pokeapi.co/api/v2/pokemon?limit=1025"
        );

        if (!response.ok) {
            throw new Error("Failed to fetch Pokémon");
        }

        const data = await response.json();
        allPokemon = data.results;
    } catch (error) {
        console.error("Error loading Pokémon:", error);
        searchResults.replaceChildren();
    }
}

// Display matching Pokémon names
function displayResults(matches) {
    searchResults.replaceChildren();

    if (matches.length === 0) {
        const message = document.createElement("div");
        message.textContent = "No Pokémon found.";
        message.className = "pokemon-result";
        message.style.cursor = "default";

        searchResults.appendChild(message);
        return;
    }

    matches.forEach((pokemon) => {
        const result = document.createElement("div");

        result.textContent = pokemon.name;
        result.className = "pokemon-result";

        searchResults.appendChild(result);
    });
}

// Filter Pokémon as the user types
searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    if (query === "") {
        searchResults.replaceChildren();
        return;
    }

    const matches = allPokemon
        .filter((pokemon) => pokemon.name.includes(query))
        .slice(0, 10);

    displayResults(matches);
});

// Start the API request
loadPokemon();
