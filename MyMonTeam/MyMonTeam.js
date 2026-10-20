/*
- fix arrowkey overriding mouseenter
*/



// =============== Element and Variable creation ===========================



// Initializing HTML elements and JS variables
// Get the main HTML elements
const team = document.getElementById("team");
const searchInput = document.getElementById("pokemon-search");
const searchResults = document.getElementById("search-results");
const gameSelect = document.getElementById("game-select");

// Variables for the game and generation selection
let game;
let gen;

// Array used for storing Pokémon; initially empty
let allPokemon = [];

// Array used for storing Moves; initially empty
let allMoves = [];

// A null array to set the selected moves to null
const selectedMoves = Array.from(
    { length: 6 },
    () => Array(4).fill(null)
);

// Track the currently highlighted search result
let highlightedIndex = 0;

// Track the Pokémon occupying each of the six team slots
// A value of null represents an empty slot
const selectedPokemon = Array(6).fill(null);

// An array for the HTMl elements for each team slot
const teamSlots = [];

// Used for finding the number of pokemon available in the generation
const generationRanges = {
    "generation-i": 151,
    "generation-ii": 251,
    "generation-iii": 386,
    "generation-iv": 493,
    "generation-v": 649,
    "generation-vi": 721,
    "generation-vii": 809,
    "generation-viii": 905,
    "generation-ix": 1025
};



// ==================== Loading API Information ===========================



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

// Move data loading
// Fetch the list of Pokémon moves and API URLs from PokéAPI.
async function loadMoves() {
    try {
        const response = await fetch(
            "https://pokeapi.co/api/v2/move?limit=1000"
        );

        if (!response.ok) {
            throw new Error("Failed to fetch moves");
        }

        const data = await response.json();
        allMoves = data.results;
    } catch (error) {
        console.error("Error loading moves:", error);
    }
}



// ================= Main Initializing Features ==========================



// Team Slot Initialization
// Creating six empty team slots and saving their references.
for (let slot = 1; slot <= 6; slot += 1) {
    const card = document.createElement("article");

    card.className = "mon-card";
    card.setAttribute("aria-label", `Slot ${slot}`);

    team.appendChild(card);
    teamSlots.push(card);
}

// Call the function to initialize the game and generation
initializeGameAndGen();



// =================== Event Listeners ============================



// Search Input Handling
// Filter Pokémon names as the user types
searchInput.addEventListener("input", () => {
    updateSearch();
});

// Keyboard Input Handling
// Allow Enter to select the currently highlighted Pokémon
searchInput.addEventListener("keydown", (event) => {

    // Move the highlighted Pokémon with up and down arrow keys
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();

        // Do nothing if there is nothing to select
        if (searchResults.children.length === 0) {
            return;
        }

        // Getting the direction to move the highlight
        const direction = event.key === "ArrowUp" ? -1 : 1;
        highlightedIndex += direction;

        // Maintaining the bounds of the highlighted Pokémon
        if (highlightedIndex < 0) {
            highlightedIndex = 0;
        }
        else if (highlightedIndex >= searchResults.children.length) {
            highlightedIndex = searchResults.children.length - 1;
        }

        // Highlight the Pokémon based on the current index + direction
        searchResults
            .querySelectorAll(".pokemon-result")
            .forEach((item, index) => {
                item.classList.remove("highlighted");
                if (index === highlightedIndex) {
                    item.classList.add("highlighted");
                }
            });

        return;
    }

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
        (pokemon) => (pokemon.name[0].toUpperCase() + pokemon.name.slice(1, pokemon.name.length))
            === highlightedResult.textContent
    );

    // Add the Pokémon if a matching result was found.
    if (selected) {
        selectPokemon(selected);
    }
});

// When user clicks out of the search bar, remove the result selection
searchInput.addEventListener("blur", () => {
    searchResults.replaceChildren();
});

// When user clicks onto the search bar, call the updateSearch function
searchInput.addEventListener("focus", () => {
    updateSearch();
});

// When user clicks on a selection, prevent the blur event listener
searchResults.addEventListener("mousedown", (event) => {
    if (event.target.closest(".pokemon-result")) {
        event.preventDefault();
    }
});

// When the user selects a different game, reset everything and reinitialize the game and gen
gameSelect.addEventListener("change", () => {
    // Clear the selected Pokémon and moves
    selectedPokemon.fill(null);

    selectedMoves.forEach((moves, index) => {
        selectedMoves[index] = Array(4).fill(null);
    });

    // Clear all six Pokémon cards
    teamSlots.forEach((card, index) => {
        card.replaceChildren();
        card.setAttribute("aria-label", `Slot ${index + 1}`);
    });

    // Clear the search bar and its results
    searchInput.value = "";
    searchResults.replaceChildren();

    // Reset search navigation
    highlightedIndex = 0;

    // Call the function to set game and gen variables
    initializeGameAndGen();
});



// =================== Main Search Functions ============================



// Search Results Display
// Display Pokémon that match the user input and highlight the first result.
function displaySearchResults(matches) {
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

        result.textContent = pokemon.name[0].toUpperCase() +
            pokemon.name.slice(1, pokemon.name.length);
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

// A function that is called when the search bar becomes focused or detects input
function updateSearch()
{
    const query = searchInput.value.trim().toLowerCase();

    // Hide the dropdown when the search input is empty.
    if (query === "") {
        searchResults.replaceChildren();
        return;
    }

    // Get the max number of Pokémon in this gen
    const maxDex = generationRanges[gen];

    // Find matching Pokémon and display at most six results.
    const matches = allPokemon
        .filter((pokemon) => {
            const id = Number(pokemon.url.split("/").filter(Boolean).pop());
            return pokemon.name.includes(query) && id <= maxDex;
        }).slice(0, 6);

    displaySearchResults(matches);
}



// =================== Pokémon Team Slot Functions ============================



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

        // Set the sprite based on the generation and game
        // If one is not found, use the default sprite
        const sprite = data.sprites.versions?.[gen]?.[game]?.front_default
            || data.sprites.front_default;

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

        // Create the moves container
        const movesContainer = document.createElement("div");
        movesContainer.className = "moves-container";

        // Create four searchable move slots
        for (let i = 1; i <= 4; i += 1) {
            const moveSlot = document.createElement("div");
            moveSlot.className = "move-slot";

            const moveInput = document.createElement("input");
            moveInput.type = "search";
            moveInput.className = "move-search-input";
            moveInput.placeholder = `Move ${i}`;
            moveInput.autocomplete = "off";

            const moveResults = document.createElement("div");
            moveResults.className = "move-search-results";

            moveSlot.append(moveInput, moveResults);
            movesContainer.appendChild(moveSlot);

            // Search for moves as the user types
            moveInput.addEventListener("input", () => {
                const query = moveInput.value.trim().toLowerCase();

                if (query === "") {
                    moveResults.replaceChildren();
                    return;
                }

                const matches = allMoves
                    .filter((move) => move.name.includes(query))
                    .slice(0, 6);

                displayMoveResults(matches, moveInput, moveResults, slotIndex, i - 1);
            });
        }

        // Create the remove button.
        const removeButton = document.createElement("button");
        removeButton.className = "remove-pokemon";
        removeButton.textContent = "×";
        removeButton.type = "button";
        removeButton.setAttribute("aria-label", `Remove ${pokemon.name}`);

        // Remove the Pokémon when the button is clicked.
        removeButton.addEventListener("click", () => {
            selectedPokemon[slotIndex] = null;
            card.replaceChildren();
            card.setAttribute("aria-label", `Slot ${slotIndex + 1}`);
            selectedMoves[slotIndex] = Array(4).fill(null);
        });

        card.replaceChildren(image, name, movesContainer, removeButton);
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

// A function used to display the search for moves
function displayMoveResults(matches, input, results, pokemonIndex, moveIndex) {
    results.replaceChildren();

    if (matches.length === 0) {
        const message = document.createElement("div");
        message.className = "move-result";
        message.textContent = "No moves found.";
        results.appendChild(message);
        return;
    }

    matches.forEach((move) => {
        const result = document.createElement("div");
        result.className = "move-result";

        result.textContent = move.name
            .replace(/-(physical|special)$/i, "")
            .replaceAll("-", " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());

        result.addEventListener("mousedown", (event) => {
            // Keep the selection working even when the input loses focus
            event.preventDefault();

            input.value = result.textContent;
            results.replaceChildren();

            selectedMoves[pokemonIndex][moveIndex] = move;
        });

        results.appendChild(result);
    });
}



// =================== Variable Functions ============================



// Set game and gen variables
function initializeGameAndGen()
{
    // Format the selected game text to use in API calls
    game = gameSelect.selectedOptions[0].text.trim().toLowerCase().replace(" / ", "-")
        .replaceAll(" ", "-").replaceAll("'", "");

    // Get the value of the selected game
    gen = gameSelect.value;
}



// Application Initialization
// Load Pokémon data when the script starts.
loadPokemon();
loadMoves();
