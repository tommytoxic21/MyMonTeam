"use strict";

// ==================== Elements and application state ====================
const team = document.getElementById("team");
const searchInput = document.getElementById("pokemon-search");
const searchResults = document.getElementById("search-results");
const gameSelect = document.getElementById("game-select");
const analysisSection = document.getElementById("type-analysis");
const analysisOutput = document.getElementById("analysis-output");
const analysisTabs = document.querySelectorAll(".analysis-tab");

const TEAM_SIZE = 6;
const MOVES_PER_POKEMON = 4;
const POKEAPI = "https://pokeapi.co/api/v2";

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

const selectedPokemon = Array(TEAM_SIZE).fill(null);
const selectedMoves = Array.from(
    { length: TEAM_SIZE },
    () => Array(MOVES_PER_POKEMON).fill(null)
);
const teamSlots = [];
const pendingSlots = new Map();
const pokemonDetailsCache = new Map();

let allPokemon = [];
let allMoves = [];
let visiblePokemonMatches = [];
let highlightedIndex = 0;
let gameVersion = 0;
let analysisRun = 0;
let gen = gameSelect.value;
let spriteGame = gameSelect.selectedOptions[0].dataset.sprite ?? "";

function createElement(tag, className = "", text = null) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== null) element.textContent = text;
    return element;
}

function formatName(name) {
    return name.replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

// ==================== API loading and caching ====================
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed: ${response.status} (${url})`);
    return response.json();
}

async function loadPokemon() {
    try {
        const data = await fetchJson(`${POKEAPI}/pokemon?limit=1025`);
        allPokemon = data.results;
        if (searchInput.value) updateSearch();
    } catch (error) {
        console.error("Could not load Pokémon:", error);
    }
}

async function loadMoves() {
    try {
        const data = await fetchJson(`${POKEAPI}/move?limit=1000`);
        allMoves = data.results;
    } catch (error) {
        console.error("Could not load moves:", error);
    }
}

// Caches the request itself, so simultaneous callers share one fetch.
function getPokemonDetails(pokemon) {
    if (!pokemonDetailsCache.has(pokemon.url)) {
        const request = fetchJson(pokemon.url).catch(error => {
            pokemonDetailsCache.delete(pokemon.url);
            throw error;
        });
        pokemonDetailsCache.set(pokemon.url, request);
    }
    return pokemonDetailsCache.get(pokemon.url);
}

// ==================== Game and Pokémon search ====================
function updateSelectedGame() {
    gen = gameSelect.value;
    spriteGame = gameSelect.selectedOptions[0].dataset.sprite ?? "";
}

function pokemonId(pokemon) {
    return Number(pokemon.url.match(/\/(\d+)\/?$/)?.[1] ?? Infinity);
}

function setHighlightedIndex(index) {
    if (!visiblePokemonMatches.length) return;

    highlightedIndex = Math.max(0, Math.min(index, visiblePokemonMatches.length - 1));
    searchResults.querySelectorAll("[data-pokemon-index]").forEach((result, i) => {
        result.classList.toggle("highlighted", i === highlightedIndex);
    });
}

function displayPokemonResults(matches) {
    visiblePokemonMatches = matches;
    highlightedIndex = 0;
    searchResults.replaceChildren();

    if (!matches.length) {
        searchResults.appendChild(createElement("div", "pokemon-result is-empty", "No Pokémon found."));
        return;
    }

    matches.forEach((pokemon, index) => {
        const result = createElement("div", "pokemon-result", formatName(pokemon.name));
        result.dataset.pokemonIndex = String(index);
        result.classList.toggle("highlighted", index === 0);
        searchResults.appendChild(result);
    });
}

function updateSearch() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
        visiblePokemonMatches = [];
        searchResults.replaceChildren();
        return;
    }

    const maxId = generationRanges[gen];
    const matches = allPokemon
        .filter(pokemon => pokemon.name.includes(query) && pokemonId(pokemon) <= maxId)
        .slice(0, 6);

    displayPokemonResults(matches);
}

function clearSearch() {
    searchInput.value = "";
    searchResults.replaceChildren();
    visiblePokemonMatches = [];
    highlightedIndex = 0;
}

// ==================== Team cards and move selection ====================
function selectedSprite(details) {
    return (
        (spriteGame && details.sprites.versions?.[gen]?.[spriteGame]?.front_default) ||
        details.sprites.other?.["official-artwork"]?.front_default ||
        details.sprites.front_default
    );
}

function showMoveResults(matches, input, results, slotIndex, moveIndex) {
    results.replaceChildren();

    if (!matches.length) {
        results.appendChild(createElement("div", "move-result", "No moves found."));
        return;
    }

    matches.forEach(move => {
        const result = createElement(
            "div", "move-result", formatName(move.name.replace(/-(physical|special)$/i, ""))
        );

        result.addEventListener("mousedown", event => {
            event.preventDefault(); // Keep the input focused while selecting.
            input.value = result.textContent;
            results.replaceChildren();
            selectedMoves[slotIndex][moveIndex] = move;
            updateTypeAnalysis(); // Move coverage will use these selections later.
        });

        results.appendChild(result);
    });
}

function createMoveInput(slotIndex, moveIndex) {
    const slot = createElement("div", "move-slot");
    const input = createElement("input", "move-search-input");
    const results = createElement("div", "move-search-results");

    input.type = "search";
    input.placeholder = `Move ${moveIndex + 1}`;
    input.autocomplete = "off";

    input.addEventListener("input", () => {
        const query = input.value.trim().toLowerCase();

        // Editing or clearing a field invalidates its former selection.
        if (selectedMoves[slotIndex][moveIndex] !== null) {
            selectedMoves[slotIndex][moveIndex] = null;
            updateTypeAnalysis();
        }

        if (!query) {
            results.replaceChildren();
            return;
        }

        const matches = allMoves.filter(move => move.name.includes(query)).slice(0, 6);
        showMoveResults(matches, input, results, slotIndex, moveIndex);
    });

    input.addEventListener("blur", () => results.replaceChildren());
    slot.append(input, results);
    return slot;
}

function removePokemon(slotIndex) {
    selectedPokemon[slotIndex] = null;
    selectedMoves[slotIndex].fill(null);
    teamSlots[slotIndex].replaceChildren();
    teamSlots[slotIndex].setAttribute("aria-label", `Slot ${slotIndex + 1}`);
    updateTypeAnalysis();
}

function renderPokemonCard(pokemon, slotIndex, sprite) {
    const card = teamSlots[slotIndex];
    const image = createElement("img", "pokemon-sprite");
    const name = createElement("p", "pokemon-name", pokemon.name);
    const moves = createElement("div", "moves-container");
    const removeButton = createElement("button", "remove-pokemon", "×");

    image.src = sprite;
    image.alt = pokemon.name;
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Remove ${pokemon.name}`);
    removeButton.addEventListener("click", () => removePokemon(slotIndex));

    for (let i = 0; i < MOVES_PER_POKEMON; i++) {
        moves.appendChild(createMoveInput(slotIndex, i));
    }

    card.replaceChildren(image, name, moves, removeButton);
    card.setAttribute("aria-label", `Slot ${slotIndex + 1}: ${pokemon.name}`);
}

async function selectPokemon(pokemon) {
    if (!pokemon) return;

    // Reserve a slot while its details load, so rapid clicks cannot overwrite it.
    const slotIndex = selectedPokemon.findIndex(
        (value, index) => value === null && !pendingSlots.has(index)
    );
    if (slotIndex === -1) return;

    const requestVersion = gameVersion;
    const requestId = Symbol("pending Pokémon");
    pendingSlots.set(slotIndex, requestId);

    try {
        const details = await getPokemonDetails(pokemon);
        if (requestVersion !== gameVersion) return;

        const sprite = selectedSprite(details);
        if (!sprite) throw new Error(`No sprite available for ${pokemon.name}`);

        selectedPokemon[slotIndex] = pokemon;
        selectedMoves[slotIndex].fill(null);
        renderPokemonCard(pokemon, slotIndex, sprite);
        clearSearch();
        updateTypeAnalysis();
    } catch (error) {
        if (requestVersion === gameVersion) {
            console.error(`Could not add ${pokemon.name}:`, error);
        }
    } finally {
        if (pendingSlots.get(slotIndex) === requestId) {
            pendingSlots.delete(slotIndex);
        }
    }
}

function resetTeamForNewGame() {
    gameVersion++; // Invalidate unfinished selections from the previous game.
    pendingSlots.clear();
    selectedPokemon.fill(null);
    selectedMoves.forEach(moves => moves.fill(null));
    teamSlots.forEach((card, index) => {
        card.replaceChildren();
        card.setAttribute("aria-label", `Slot ${index + 1}`);
    });

    clearSearch();
    updateSelectedGame();
    updateTypeAnalysis(); // Also invalidates unfinished analysis and hides the chart.
}

// ==================== Type matchup rules ====================
// Offensive chart: strong = 2×, weak = ½×, immune = 0× against defending type.
const typeChart = {
    normal: { strong: [], weak: ["rock", "steel"], immune: ["ghost"] },
    fire: { strong: ["grass", "ice", "bug", "steel"], weak: ["fire", "water", "rock", "dragon"] },
    water: { strong: ["fire", "ground", "rock"], weak: ["water", "grass", "dragon"] },
    electric: { strong: ["water", "flying"], weak: ["electric", "grass", "dragon"], immune: ["ground"] },
    grass: { strong: ["water", "ground", "rock"], weak: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"] },
    ice: { strong: ["grass", "ground", "flying", "dragon"], weak: ["fire", "water", "ice", "steel"] },
    fighting: { strong: ["normal", "ice", "rock", "dark", "steel"], weak: ["poison", "flying", "psychic", "bug", "fairy"], immune: ["ghost"] },
    poison: { strong: ["grass", "fairy"], weak: ["poison", "ground", "rock", "ghost"], immune: ["steel"] },
    ground: { strong: ["fire", "electric", "poison", "rock", "steel"], weak: ["grass", "bug"], immune: ["flying"] },
    flying: { strong: ["grass", "fighting", "bug"], weak: ["electric", "rock", "steel"] },
    psychic: { strong: ["fighting", "poison"], weak: ["psychic", "steel"], immune: ["dark"] },
    bug: { strong: ["grass", "psychic", "dark"], weak: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"] },
    rock: { strong: ["fire", "ice", "flying", "bug"], weak: ["fighting", "ground", "steel"] },
    ghost: { strong: ["psychic", "ghost"], weak: ["dark"], immune: ["normal"] },
    dragon: { strong: ["dragon"], weak: ["steel"], immune: ["fairy"] },
    dark: { strong: ["psychic", "ghost"], weak: ["fighting", "dark", "fairy"] },
    steel: { strong: ["ice", "rock", "fairy"], weak: ["fire", "water", "electric", "steel"] },
    fairy: { strong: ["fighting", "dragon", "dark"], weak: ["fire", "poison", "steel"] }
};

const typeColors = {
    normal: "#a7a9aa", fire: "#f58f68", water: "#78b3ff", electric: "#f7d66a",
    grass: "#7ed09b", ice: "#9ee6e6", fighting: "#e07878", poison: "#c58ee7",
    ground: "#dcb67c", flying: "#adbdf5", psychic: "#f39bc0", bug: "#b4c66d",
    rock: "#ccb88c", ghost: "#a9a0e2", dragon: "#9b89ec", dark: "#a49aab",
    steel: "#a5bbc8", fairy: "#efb5ea"
};

const attackTypes = Object.keys(typeChart);
const multiplierLabels = {
    0: "0×", 0.25: "¼×", 0.5: "½×", 1: "1×", 2: "2×", 4: "4×"
};
const generationNumbers = {
    i: 1, ii: 2, iii: 3, iv: 4, v: 5,
    vi: 6, vii: 7, viii: 8, ix: 9
};

function generationNumber(name) {
    return generationNumbers[name.replace("generation-", "")] ?? 9;
}

function availableTypes(generation) {
    return attackTypes.filter(type =>
        (generation > 1 || !["dark", "steel", "fairy"].includes(type)) &&
        (generation >= 6 || type !== "fairy")
    );
}

function matchupFactor(attackType, defenseType, generation) {
    // Original Red/Blue/Yellow type-chart exceptions.
    if (generation === 1) {
        if (attackType === "bug" && defenseType === "poison") return 2;
        if (attackType === "poison" && defenseType === "bug") return 2;
        if (attackType === "ghost" && defenseType === "psychic") return 0;
        if (attackType === "ice" && defenseType === "fire") return 1;
    }

    // Steel resisted Dark and Ghost until X/Y (Generation 6).
    if (generation >= 2 && generation <= 5 && defenseType === "steel" &&
        (attackType === "ghost" || attackType === "dark")) {
        return 0.5;
    }

    const entry = typeChart[attackType];
    if (!entry) return 1;
    if (entry.immune?.includes(defenseType)) return 0;
    if (entry.strong.includes(defenseType)) return 2;
    if (entry.weak.includes(defenseType)) return 0.5;
    return 1;
}

function incomingMultiplier(attackType, defendingTypes, generation) {
    return defendingTypes.reduce(
        (total, type) => total * matchupFactor(attackType, type, generation), 1
    );
}

function typesInGeneration(details, generation) {
    const past = (details.past_types ?? [])
        .filter(entry => generation <= generationNumber(entry.generation.name))
        .sort((a, b) => generationNumber(a.generation.name) - generationNumber(b.generation.name));

    const entries = past.length ? past[0].types : details.types;
    return [...entries]
        .sort((a, b) => a.slot - b.slot)
        .map(entry => entry.type.name);
}

// ==================== Defensive coverage table ====================
function typeBadge(type) {
    const badge = createElement("span", "analysis-type", type);
    badge.style.setProperty("--type-color", typeColors[type] ?? "#aaa");
    return badge;
}

function multiplierClass(multiplier) {
    if (multiplier === 0) return "analysis-immune";
    if (multiplier === 4) return "analysis-weak analysis-quad";
    if (multiplier > 1) return "analysis-weak";
    if (multiplier < 1) return "analysis-resistant";
    return "analysis-neutral";
}

function buildTypeAnalysis(members, generation) {
    const available = availableTypes(generation);
    const container = createElement("div");
    const wrapper = createElement("div", "analysis-table-scroll");
    const table = createElement("table", "analysis-table");
    const headerRow = createElement("tr");

    headerRow.appendChild(createElement("th", "", "Attack Type"));
    members.forEach(({ name, types }) => {
        const heading = createElement("th", "analysis-mon-heading");
        heading.append(
            createElement("span", "analysis-mon-name", formatName(name)),
            createElement("small", "", types.join(" / "))
        );
        headerRow.appendChild(heading);
    });
    headerRow.appendChild(createElement("th", "", "Team Defense"));

    const head = createElement("thead");
    head.appendChild(headerRow);
    table.appendChild(head);

    const rows = available.map(type => {
        const multipliers = members.map(member =>
            incomingMultiplier(type, member.types, generation)
        );
        return {
            type,
            multipliers,
            resistantCount: multipliers.filter(value => value < 1).length,
            weakCount: multipliers.filter(value => value > 1).length
        };
    });

    // Uncovered threats first, with the most exposed Pokémon at the top.
    rows.sort((a, b) =>
        Number(a.resistantCount > 0) - Number(b.resistantCount > 0) ||
        b.weakCount - a.weakCount
    );

    const body = createElement("tbody");
    rows.forEach(({ type, multipliers, resistantCount, weakCount }) => {
        const row = createElement("tr");
        const attack = createElement("th");
        attack.appendChild(typeBadge(type));
        row.appendChild(attack);

        multipliers.forEach(multiplier => {
            row.appendChild(createElement(
                "td", multiplierClass(multiplier),
                multiplierLabels[multiplier] ?? `${multiplier}×`
            ));
        });

        const defense = createElement("td");
        if (resistantCount > 0) {
            defense.className = "analysis-coverage-ok";
            defense.textContent = `${resistantCount} resist / immune`;
        } else {
            row.classList.add("analysis-uncovered");
            if (weakCount > 0) row.classList.add("analysis-exposed");

            defense.className = "analysis-coverage-gap";
            defense.textContent = weakCount > 0
                ? `No resistance (${weakCount} weak)`
                : "No resistance";

            // Suggestions are individual types; a dual type may cancel a resistance.
            const counters = available.filter(defendingType =>
                matchupFactor(type, defendingType, generation) < 1
            );
            defense.appendChild(createElement(
                "small", "analysis-type-suggestion",
                counters.length
                    ? `Consider: ${counters.slice(0, 4).join(", ")}`
                    : "No single type resists this attack"
            ));
        }

        row.appendChild(defense);
        body.appendChild(row);
    });

    table.appendChild(body);
    wrapper.appendChild(table);
    container.append(
        wrapper,
        createElement("p", "analysis-legend",
            "0× Immune · ¼× / ½× Resistant · 1× Neutral · 2× Weak · 4× Very Weak")
    );
    return container;
}

async function updateTypeAnalysis() {
    const run = ++analysisRun;
    const currentGeneration = generationNumber(gen);
    const selections = selectedPokemon.filter(Boolean);

    analysisSection.hidden = false;
    if (!analysisOutput.querySelector("table")) {
        analysisOutput.textContent = "Loading type matchups...";
    }

    try {
        const details = await Promise.all(selections.map(getPokemonDetails));
        if (run !== analysisRun) return;

        const members = selections.map((pokemon, index) => ({
            name: pokemon.name,
            types: typesInGeneration(details[index], currentGeneration)
        }));
        analysisOutput.replaceChildren(buildTypeAnalysis(members, currentGeneration));
    } catch (error) {
        if (run !== analysisRun) return;
        console.error("Type analysis failed:", error);
        analysisOutput.textContent = "Could not load Pokémon types. Please try again.";
    }
}

// ==================== Analysis tab navigation ====================
function switchAnalysisTab(selectedTab) {
    analysisTabs.forEach(tab => {
        const active = tab === selectedTab;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        document.getElementById(tab.getAttribute("aria-controls")).hidden = !active;
    });
}

// ==================== Event listeners and initialization ====================
function initializeTeamSlots() {
    for (let index = 0; index < TEAM_SIZE; index++) {
        const card = createElement("article", "mon-card");
        card.setAttribute("aria-label", `Slot ${index + 1}`);
        team.appendChild(card);
        teamSlots.push(card);
    }
}

function initializeEvents() {
    searchInput.addEventListener("input", updateSearch);
    searchInput.addEventListener("focus", updateSearch);
    searchInput.addEventListener("blur", () => {
        searchResults.replaceChildren();
        visiblePokemonMatches = [];
    });

    searchInput.addEventListener("keydown", event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (!visiblePokemonMatches.length) return;
            event.preventDefault();
            setHighlightedIndex(highlightedIndex + (event.key === "ArrowDown" ? 1 : -1));
        } else if (event.key === "Enter") {
            event.preventDefault();
            selectPokemon(visiblePokemonMatches[highlightedIndex]);
        }
    });

    // Event delegation avoids a separate click/hover handler for every result.
    searchResults.addEventListener("pointermove", event => {
        const result = event.target.closest("[data-pokemon-index]");
        if (result) setHighlightedIndex(Number(result.dataset.pokemonIndex));
    });
    searchResults.addEventListener("mousedown", event => {
        if (event.target.closest("[data-pokemon-index]")) event.preventDefault();
    });
    searchResults.addEventListener("click", event => {
        const result = event.target.closest("[data-pokemon-index]");
        if (result) selectPokemon(visiblePokemonMatches[Number(result.dataset.pokemonIndex)]);
    });

    gameSelect.addEventListener("change", resetTeamForNewGame);

    analysisTabs.forEach((tab, index) => {
        tab.addEventListener("click", () => switchAnalysisTab(tab));
        tab.addEventListener("keydown", event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const direction = event.key === "ArrowRight" ? 1 : -1;
            const next = analysisTabs[(index + direction + analysisTabs.length) % analysisTabs.length];
            switchAnalysisTab(next);
            next.focus();
        });
    });
}

initializeTeamSlots();
initializeEvents();
loadPokemon();
loadMoves();
updateTypeAnalysis();