// Initializing HTML elements and JS variables
// Get the main HTML elements
const team = document.getElementById("team");
const searchInput = document.getElementById("pokemon-search");
const searchResults = document.getElementById("search-results");

// Array used for storing Pokémon; initially empty
let allPokemon = [];

// Track the currently highlighted search result
let highlightedIndex = 0;

// Track the Pokémon occupying each of the six team slots
// A value of null represents an empty slot
const selectedPokemon = Array(6).fill(null);

// An array for the HTMl elements for each team slot
const teamSlots = [];



// Team Slot Initialization
// Creating six empty team slots and saving their references.
for (let slot = 1; slot <= 6; slot += 1) {
    const card = document.createElement("article");

    card.className = "mon-card";
    card.setAttribute("aria-label", `Slot ${slot}`);

    team.appendChild(card);
    teamSlots.push(card);
}



// Pokémon Data Loading
// Fetch the list of Pokémon names and API URLs from PokéAPI.
async function loadPokemon() {
    try {
        const response = await fetch(
            "https://pokeapi.co/api/v2/pokemon?limit=1025"
        );

        // Handle unsuccessful HTTP responses.
        if (!response.ok) {
            throw new Error("Failed to fetch Pokémon");
        }

        // Save the returned Pokémon list for searching.
        const data = await response.json();
        allPokemon = data.results;
    } catch (error) {
        // Log loading errors and clear any search results.
        console.error("Error loading Pokémon:", error);
        searchResults.replaceChildren();
    }
}



// Search Results Display
// Display Pokémon that match the user input and highlight the first result.
function displayResults(matches) {
    searchResults.replaceChildren();
    highlightedIndex = 0;

    // Display a message when no Pokémon match the search.
    if (matches.length === 0) {
        const message = document.createElement("div");

        message.textContent = "No Pokémon found.";
        message.className = "pokemon-result";
        message.style.cursor = "default";

        searchResults.appendChild(message);
        return;
    }

    // Create one clickable result for each matching Pokémon.
    matches.forEach((pokemon, index) => {
        const result = document.createElement("div");

        result.textContent = pokemon.name;
        result.className = "pokemon-result";

        // Highlight the first result by default.
        if (index === highlightedIndex) {
            result.classList.add("highlighted");
        }

        // Update the highlighted result when the mouse enters it.
        result.addEventListener("mouseenter", () => {
            highlightedIndex = index;

            // Remove the highlight from all search results.
            searchResults
                .querySelectorAll(".pokemon-result")
                .forEach((item) => {
                    item.classList.remove("highlighted");
                });

            // Highlight the result currently under the mouse.
            result.classList.add("highlighted");
        });

        // Add the Pokémon when its search result is clicked.
        result.addEventListener("click", () => {
            selectPokemon(pokemon);
        });

        searchResults.appendChild(result);
    });
}



// Pokémon Selection and Team Updates
// Add a selected Pokémon to the next available team slot.
async function selectPokemon(pokemon) {
    if (!pokemon) {
        return;
    }

    // Find the first empty slot, starting from the left.
    const slotIndex = selectedPokemon.findIndex(
        (slot) => slot === null
    );

    // Stop if all six team slots are occupied.
    if (slotIndex === -1) {
        console.log("Your team is full!");
        return;
    }

    try {
        // Fetch the selected Pokémon's detailed information.
        const response = await fetch(pokemon.url);

        if (!response.ok) {
            throw new Error("Failed to fetch Pokémon details");
        }

        const data = await response.json();

        // Prefer official artwork, falling back to the regular sprite.
        const sprite =
            data.sprites.other?.["official-artwork"]?.front_default ||
            data.sprites.front_default;

        // Stop if no usable sprite is available.
        if (!sprite) {
            throw new Error("No sprite available for this Pokémon");
        }

        // Record the Pokémon in the selected team slot.
        selectedPokemon[slotIndex] = pokemon;

        // Create an image element for the Pokémon's sprite.
        const image = document.createElement("img");

        image.src = sprite;
        image.alt = pokemon.name;
        image.className = "pokemon-sprite";

        // Create a label displaying the Pokémon's name.
        const name = document.createElement("p");

        name.textContent = pokemon.name;
        name.className = "pokemon-name";

        // Display the sprite and name in the corresponding team card.
        const card = teamSlots[slotIndex];

        card.replaceChildren(image, name);
        card.setAttribute(
            "aria-label",
            `Slot ${slotIndex + 1}: ${pokemon.name}`
        );

        // Clear the search input and close the results dropdown.
        searchInput.value = "";
        searchResults.replaceChildren();
        highlightedIndex = 0;

        console.log(`Added ${pokemon.name} to slot ${slotIndex + 1}.`);
    } catch (error) {
        // Report errors without crashing the application.
        console.error("Couldn't add Pokémon:", error);
    }
}



// Search Input Handling
// Filter Pokémon names as the user types
searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    // Hide the dropdown when the search input is empty.
    if (query === "") {
        searchResults.replaceChildren();
        return;
    }

    // Find matching Pokémon and display at most six results.
    const matches = allPokemon
        .filter((pokemon) => pokemon.name.includes(query))
        .slice(0, 6);

    displayResults(matches);
});



// Keyboard Input Handling
// Allow Enter to select the currently highlighted Pokémon
searchInput.addEventListener("keydown", (event) => {
    // Ignore keys other than Enter
    if (event.key !== "Enter") {
        return;
    }

    // Prevent the default Enter key behavior.
    event.preventDefault();

    // Get the highlighted result, excluding the no-results message.
    const highlightedResult = searchResults.querySelectorAll(
        ".pokemon-result:not([style*='cursor: default'])"
    )[highlightedIndex];

    // Do nothing if there is no selectable result.
    if (!highlightedResult) {
        return;
    }

    // Find the Pokémon represented by the highlighted result.
    const query = searchInput.value.trim().toLowerCase();

    const matches = allPokemon.filter(
        (pokemon) => pokemon.name.includes(query)
    );

    const selected = matches.find(
        (pokemon) => pokemon.name === highlightedResult.textContent
    );

    // Add the Pokémon if a matching result was found.
    if (selected) {
        selectPokemon(selected);
    }
});



// Application Initialization
// Load Pokémon data when the script starts.
loadPokemon();
