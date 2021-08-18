"use strict";
const nullChar = "@";
const depth = 4;
let cityNames;
let markovData = {};
let loadedNames = 0;
let loadedMarkov = 0;
let result = document.querySelector("#result");
start();

function refreshLoading() {
    result.innerText = "Chargement " + Math.round((loadedNames + loadedMarkov) * 50) + "%";
}

function onResize() {
    document.body.style.height = window.innerHeight + 'px'; //"hack" for safari ios
}

async function start() {
    onResize();
    window.addEventListener("resize", onResize);
    refreshLoading();
    try {
        let [noms, markov] = await Promise.all([
            loadJSON("noms.json", (p) => loadedNames = p.loaded / (p.total || 527807)),
            loadJSON("markov.json", (p) => loadedMarkov = p.loaded / (p.total || 1760271))]);
        cityNames = JSON.parse(noms);
        markovData = JSON.parse(markov);
    } catch (e) {
        console.error(e);
    }
    onClick();
    let touchEvent = 'ontouchstart' in window ? 'touchstart' : 'click';
    document.body.addEventListener(touchEvent, onClick);
    document.body.addEventListener("keydown", event => {
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

async function onClick() {
    fadeOut();
    let rand = getRandomName();
    await delay(100);
    setAndFadeIn(rand);
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setAndFadeIn(str) {
    result.innerText = str;
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

    //todo: get rid of "au-en" "les-sur" "des le"... "saint saint" (tolowercase?)

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
    }
    if (tooSimilar) result = getRandomName();
    return result;
}

function fadeOut() {
    document.body.style.color = "white";
}

function fadeIn() {
    document.body.style.color = "black";
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

    // Total computation
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
    return { areSimilar: true, difference: Math.abs(str2.length - str1.length) };
}

//splits string using '-' & ' ', keeping the original delimiter in the resulting array
function splitWithDelimiters(str) {
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