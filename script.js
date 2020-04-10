"use strict";
const nullChar = "@";
const depth = 4;
let cityNames;
let markovData = {};
let loadedNames = 0;
let loadedMarkov = 0;
start();

function refreshLoading() {
    document.getElementById("result").innerText = "Chargement " + Math.round((loadedNames + loadedMarkov) * 50) + "%";
}

function onResize() {
    document.querySelector("body").style.height = window.innerHeight + 'px'; //"hack" for safari ios
}

async function start() {
    onResize();
    window.addEventListener("resize", onResize);
    refreshLoading();
    try {
        await Promise.all([
            loadJSON("noms.json", (p) => loadedNames = p.loaded / (p.total || 527807)),
            loadJSON("markov.json", (p) => loadedMarkov = p.loaded / (p.total || 1760271))])
            .then(([noms, markov]) => {
                cityNames = JSON.parse(noms);
                markovData = JSON.parse(markov);
            });
    } catch (e) {
        console.error(e);
    }
    onClick();
    let touchEvent = 'ontouchstart' in window ? 'touchstart' : 'click';
    let body = document.getElementsByTagName("body")[0];
    body.addEventListener(touchEvent, onClick);
    body.addEventListener("keydown", event => {
        if (event.key === "Spacebar" || event.key === " " || event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "ArrowDown") {
            onClick();
        }
    });

}

async function loadJSON(url, onProgress) {
    let request = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
        request.onreadystatechange = () => {
            if (request.readyState !== 4) return; //The request isn't ready
            if (request.status >= 200 && request.status < 300) {
                resolve(request.responseText);
            } else {
                reject({
                    status: request.status,
                    statusText: request.statusText
                });
            }
        };
        request.onprogress = (p) => {
            onProgress(p);
            refreshLoading();
        };
        request.overrideMimeType("application/json");
        request.open('GET', url, true);
        request.send(null);
    });
}

function substrOrNullChar(str, index, length) { //Returns substring, negative index returns nullChar
    let result = "";
    if (index < 0) {
        result += nullChar.repeat(-index);
        result += str.substr(0, length + index);
    } else {
        result = str.substr(index, length);
    }
    return result;
}

function onClick() {
    fadeOut();
    let rand = getRandomName();
    delay(100).then(() => setAndFadeIn(rand));
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setAndFadeIn(str) {
    document.getElementById("result").innerText = str;
    fadeIn();
}

function getRandomName() {
    let result = "";
    let index = 0;
    let nextLetter = getNextLetter(markovData[nullChar.repeat(depth)]);
    while (nextLetter !== nullChar) {
        result += nextLetter;
        index++;
        let key = substrOrNullChar(result, index - depth, depth);
        if (!markovData.hasOwnProperty(key)) {
            console.error(`key ${key} doesn't exist`);
            result = getRandomName();
            break;
        }
        nextLetter = getNextLetter(markovData[key]);
    }

    //todo: niquer les "au-en" "les-sur" "des le"... "saint saint" (tolowercase?)

    let splits = splitWithDelimiters(result);
    let modified = false;

    //add "s"
    for (let i = 0; i + 2 < splits.length; i += 2) {
        if (splits[i] === "Les" || splits[i] === "les" || splits[i] === "lès" || splits[i] === "Lès" || splits[i] === "aux") {
            if (splits[i + 2] === "en" || splits[i + 2] === "au" || splits[i + 2] === "et" || splits[i + 2] === "sur") {
                continue;
            }
            if (!splits[i + 2].endsWith("s") && !splits[i + 2].endsWith("x")) {
                splits[i + 2] = splits[i + 2] + "s";
                modified = true;
            }
        }
    }
    if (modified) {
        result = splits.join("");
    }

    let tooSimilar = false;
    for (let name of cityNames) {
        const similarity = computeSimilarity(result, name);
        if (similarity.areSimilar) {
            tooSimilar = true;
            break;
        }
        // if (!similarity.areSimilar) continue;
        // if (similarity.areSimilar) {
        //     tooSimilar = true;
        //     console.log(name + " > " +result);
        //     break;
        // }
        // if (similarity.difference <= 1) {
        //     tooSimilar = true;
        //     break;
        // }
    }
    if (tooSimilar) result = getRandomName();
    return result;
}

function fadeOut() {
    document.querySelector("body").style.color = "white";
}

function fadeIn() {
    document.querySelector("body").style.color = "black";
}

function getNextLetter(token) {
    let rand = Math.round(Math.random() * token.total); //todo: out of range?
    let index = 0;
    for (let candidate in token.counts) {
        if (!token.counts.hasOwnProperty(candidate)) continue;
        index += token.counts[candidate];
        if (rand <= index) {
            return candidate;
        }
    }
}

function createMarkovData(names) {
    function createOrGetLetterCount(key) {
        if (!tokens.hasOwnProperty(key)) {
            tokens[key] = new LetterCount();
        }
        return tokens[key];
    }

    let tokens = {};
    // creation of markov data
    for (name of names) {
        for (let i = 0; i < name.length; i++) {
            let key = substrOrNullChar(name, i - depth, depth);
            createOrGetLetterCount(key).addLetter(name.charAt(i));
            let isLast = i + 1 >= name.length;
            if (isLast) {
                let lastKey = name.substr((i + 1) - depth, depth);
                createOrGetLetterCount(lastKey).addLetter("@");
            }
        }
    }

    // Calcul du total
    for (let dictProp in tokens) {
        if (!tokens.hasOwnProperty(dictProp)) continue;
        let count = 0;
        for (let countProp in tokens[dictProp].counts) {
            if (!tokens[dictProp].counts.hasOwnProperty(countProp)) continue;
            count += tokens[dictProp].counts[countProp];
        }
        tokens[dictProp].total = count;
    }

    return tokens;
}

function computeSimilarity(str1, str2) {
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
    if (str1 === str2) return { areSimilar: true, difference: 0 };
    if (!str2.includes(str1) && !str1.includes(str2)) return { areSimilar: false };
    // console.log(str1, str2);
    // let sA = str1.split(/([- ]+)/);
    let splitsA = splitWithoutDelimiters(str1);
    let splitsB = splitWithoutDelimiters(str2);
    for (let i = 0; i < splitsA.length; i++) {
        if (uselessSplit(splitsA[i])) continue;
        for (let j = 0; j < splitsB.length; j++) {
            if (uselessSplit(splitsB[j])) continue;
            if (splitsA[i] == splitsB[j]) {
                console.log(str1, str2, splitsA[i], splitsB[j]);
                return { areSimilar: true };
            }

        }
    }
    return { areSimilar: true, difference: Math.abs(str2.length - str1.length) };
}

function uselessSplit(split) {
    let useless = [
        "la",
        "le",
        "les",
        "lès",
        "saint",
        "sainte",
        "saintes",
        "saints",
        "au",
        "aux",
        "en",
        "du",
        "sur",
        "vallée",
        "vallées",
        "mont",
        "monts",
        "port",
        "ports",
        "mer",
        "provence",
        "châtel",
        "chateau",
        "chateaux",
        "château",
        "châteaux",
        "hameau",
        "hameaux",
        "bois",
        "royal",
        "royale",
        "royals",
        "royales",
        "rivière",
        "rivières",
        "vieil",
        "vieille",
        "vieilles",
        "vieu",
        "vieux",
        "fontaine",
        "fontaines",
        "forge",
        "forges",
        "pont",
        "ponts",
        "val",
        "vals",
        "vaux",
        "falaise",
        "falaises",
        "champs",
        "loge",
        "loges",
        "pierre",
        "pierres",
        "maray",
        "marais",
        "léger",
        "croix",
        "france",
        "bourg",
        "bourgs",
        "ville",
        "villes",
        "champagne",
        "doubs",
        "petit",
        "petite",
        "petits",
        "petites",
        "grand",
        "grands",
        "grande",
        "grandes",
        "vigne",
        "vignes",
        "mort",
        "morts",
        "morte",
        "mortes",
        "motte",
        "mottes",
        "beau",
        "beaux",
        "belle",
        "belles",
        "bain",
        "bains",
        "saône",
        "église",
        "églises",
        "campagne",
        "campagnes",
        "notre",
        "nôtre",
        "nos",
        "chemin",
        "chemins",
        "rue",
        "route",
        "routes",
        "forest",
        "forêt",
        "forêts",
        "moulin",
        "moulins",
        "mignon",
        "noyer",
        "noyers",
        "mine",
        "mines",
        "chapelle",
        "chapelles",
        "père",
        "mère",
        "soeur",
        "soeurs",
        "sœur",
        "sœurs",
        "frère",
        "frères",
        "vert",
        "verte",
        "vertes",
        "verts",
        "roche",
        "roches",
        "loup",
        "loups",
        "jaune",
        "jaunes",
        "roi",
        "rois",
        "reine",
        "reines",
        "l'hôpital",
        "hôpital",
        "hôpitaux",
        "dame",
        "dames",
        "merle",
        "merles",
        "village",
        "villages",
        "isle",
        "isles",
        "île",
        "îles",
        "bas",
        "haut",
        "hauts",
        "haute",
        "hautes",
        "parc",
        "parcs",
        "nord",
        "sud",
        "est",
        "ouest",
        "granges",
        "grange",
        "porte",
        "portes",
        "lac",
        "lacs",
        "montagne",
        "montagnes",
        "noir",
        "noirs",
        "noire",
        "noires",
        "or",
        "d'or",
        "entre",
        "truite",
        "truites",
        "lande",
        "landes",
        "un",
        "deux",
        "trois",
        "quatre",
        "cinq",
        "six",
        "sept",
        "huit",
        "neuf",
        "dix",
        "onze",
        "douze",
        "treize",
        "cent",
        "cents",
        "l'isle",
        "bon",
        "bons",
        "bonne",
        "bonnes",
        "vive",
        "vives",
        "vif",
        "vifs",
        "maison",
        "maisons",
        "étang",
        "étangs",
        "l'étang",
        "châtillon",
        "châtillons",
        "tour",
        "tours",
        "bretagne",
        "plaine",
        "plaines",
        "colline",
        "collines",
        "pic",
        "pics",
        "midi",
        "près",
        "doux",
        "dur",
        "durs",
        "parade",
        "parades",
        "comte",
        "comté",
        "dessus",
        "dessous",
        "prix",
        "comté",
        "amant",
        "amants",
        "propre",
        "propres",
        "sale",
        "sales",
        "salle",
        "salles",
        "vent",
        "vents",
        "bel",
        "bels",
        "air",
        "airs",
        "eau",
        "eaux",
        "terre",
        "terres",
        "avant",
        "après",
        "derrière",
        "devant",
        "côté",
        "à",
        "et",
        "ou",
        "où",
        "bière",
        "bières",
        "pré",
        "prés",
        "fin",
        "fins",
        "fine",
        "fines",
        "castillon",
        "castillons",
        "roque",
        "roques",
        "fort",
        "forte",
        "fortes",
        "forts",
        "châtelet",
        "châtelets",
        "nant",
        "nants",
        "fleur",
        "fleurs",
        "temple",
        "temples",
        "neuf",
        "neuve",
        "neufs",
        "neuves",
        "janvier",
        "fevrier",
        "mars",
        "avril",
        "mai",
        "juin",
        "juillet",
        "août",
        "septembre",
        "octobre",
        "novembre",
        "décembre",
        "grenier",
        "greniers",
        "commune",
        "communes",
        "fontaine",
        "fontaines",
        "lay",
        "villard",
        "preux",
        "sauvage",
        "sauvages",
        "nouveau",
        "nouveaux",
        "nouvel",
        "nouvelle",
        "nouvelles",
        "palais",
        "pin",
        "pins",
        "pain",
        "pains",
        "puis",
        "jour",
        "jours",
        "nuit",
        "nuits",
        "blé",
        "blés",
        "d'or",
        "doré",
        "dorés",
        "dorées",
        "dorée",
        "lumière",
        "chêne",
        "chênes",
        "joie",
        "joies",
        "hôtel",
        "l'hôtel",
        "hôtels",
        "fou",
        "folle",
        "fous",
        "folles",
        "herbe",
        "herbes",
        "bord",
        "bords",
        "felix",
        "quentin",
        "georges",
        "louis",
        "templier",
        "templiers",
        "marie",
        "romain",
        "brûlé",
        "brûlée",
        "brûlées",
        "brûlés",
        "lieu",
        "lieux",
        "beaulieu",
        "seuil",
        "seuiles",
        "seul",
        "seuls",
        "seules",
        "seule",
        "martin",
        "villiers",
        "villier",
        "quai",
        "quais",
        "marche",
        "marches",
        "antoine",
        "denis",
        "moselle",
        "sève",
        "rémy",
        "vincent",
        "thomas",
        "berger",
        "bergère",
        "bergers",
        "bergères",
        "marché",
        "marchés",
        "courbe",
        "courbes",
        "matin",
        "matins",
        "soir",
        "soirs",
        "laurent",
        "colombe",
        "colombes",
        "mort",
        "mortes",
        "morte",
        "morts",
        "forge",
        "forges",
        "paul",
        "aube",
        "aubes",
        "préau",
        "préaux",
        "jean",
        "cuve",
        "cuves",
        "vin",
        "vins",
        "raisin",
        "raisins",
        "rose",
        "rosière",
        "aire",
        "maurice",
        "menu",
        "menus",
        "maxime",
        "didier",
        "basse",
        "basses",
        "français",
        "française",
        "jeune",
        "jeunes",
        "christophe",
        "julien",
        "germain",
        "passage",
        "passages",
        "cours",
        "lit",
        "gras",
        "vers",
        "nicolas",
        "léonard",
        "dieu",
        "dieux",
        "françois",
        "plan",
        "plans",
        "mons",
        "mon",
        "vos",
        "rosier",
        "rosiers",
        "rosière",
        "rosières",
        "épine",
        "l'épine",
        "épines",
        "châteauneuf",
        "bar",
        "frais",
        "féline",
        "félines",
        "corps",
        "pauvre",
        "pauvres",
        "remy",
        "fleury",
        "bague",
        "bagues",
        "beauchêne",
        "cheval",
        "chevaux",
        "d'oiseau",
        "cieux",
        "félix",
        "source",
        "sources",
        "bresse",
        "vignoble",
        "vignobles",
        "noble",
        "nobles",
        "luc",
        "corbière",
        "corbières",
        "vivien",
        "bâtie",
        "bâties",
        "lys",
        "yvette",
        "bonnet",
        "héron",
        "rocher",
        "rochers",
        "bèrge",
        "bèrges",
        "roy",
        "adrien",
        "lisse",
        "villette",
        "pommier",
        "pommiers",
        "piano",
        "madame",
        "monsieur",
        "puits",
        "puit",
        "flot",
        "flots",
        "athée",
        "athé",
        "milieu",
        "plage",
        "plages",
        "jumeau",
        "jumeaux",
        "jumelles",
        "belleville",
        "hélène",
        "compôte",
        "jacques",
        "jacque",
        "nicole",
        "mur",
        "murs",
        "charles",
        "léon",
        "vallon",
        "seine",
        "moyen",
        "court",
        "long",
        "longue",
        "puy",
        "joseph",
        "automne",
        "printemps",
        "été",
        "hiver",
        "michel",
        "grand'",
        "pucelle",
        "grosville",
        "d'elle",
        "elle",
        "il",
        "désert",
        "clef",
        "clefs",
    ];
    return useless.includes(split);
}

function splitWithDelimiters(str) { //splits string using '-' & ' ', keeping the original delimiter in the resulting array
    return str.split(/([- ])/g);
}

function splitWithoutDelimiters(str) {
    return str.split(/[- ]+/);
}

class LetterCount {
    constructor() {
        this.counts = {};
        this.total = 0;
    }

    addLetter(letter) {
        if (this.counts.hasOwnProperty(letter)) {
            this.counts[letter]++;
        } else {
            this.counts[letter] = 1;
        }
        this.total++;
    }
}