'use strict';

const fs = require('fs');
const readlines = require('n-readlines');
var Dictionary = require('./dictionary.js');
var Language = require('./language.js');
var LanguageReader = require('./language-reader.js');
var StringUtil = require('./string-util.js');

const SOFT_HYPHEN = '\u00AD';

// globals - yuck
var languages = {};
var dictionaries = {};

var dictionary;
var sourceLang;
var freqThreshold;
var searched = {}

function cleanText(text)
{
    var result = "";

    for (let i = 0; i < text.length; i++) {
        var ch = text[i];
        if (StringUtil.isWhitespace(ch)) {
            result += ' ';
        }
        else if (StringUtil.isControlChar(ch)) {
            // ignore
        }
        else if (StringUtil.isPunctuation(ch)) {
            if (ch == SOFT_HYPHEN)
                result += ''; // ignore
            else if (StringUtil.isSentenceTerminator(ch) || StringUtil.isWordPunctuation(ch))
                result += ch; // keep
            else
                result += ' '; // replace with space
        }
        else {
            result += ch;
        }
    }

    // replace multiple spaces with a single space, and trim
    result = result.trim().replace(/ +/g, " ");

    return result;
}

function isKnownWord(word) {
    if (sourceLang.isInFrequencyList(word))
        return true;
    else if (dictionary.lookup(word).length > 0)
        return true;
    return false;
}

function findFirstOf(str, pos, chars)
{
    while (pos < str.length) {
        if (chars.includes(str[pos]))
            return pos;
        pos++;
    }
    return pos;
}

function getNextSentenceWords(text, pos, words) {

    let start = pos;
    let end = -1;
    let sentenceEnded = false;

    do {
        end = findFirstOf(text, start, " !?;");
        end++;
        let word = text.slice(start, end).trim();
        let done = false;
        do {
            let last = word.slice(-1);
            if (last == " ") {
                word = word.slice(0, -1);
            }
            else if (last == "!" || last == "?" || last == ";") {
                sentenceEnded = true;
                word = word.slice(0, -1);
            }
            else if (last == ".") {
                // could be end of sentence, but could also be an abbreviation
                if (word.match(/^[0-9\.\-\?!;]+$/)) {
                    // all numbers and/or punctuation
                    done = true;
                    sentenceEnded = (word.match(/[0-9]+/) == null);
                }
                else if (isKnownWord(word)) {
                    done = true;
                }
                else {
                    sentenceEnded = true;
                    word = word.slice(0, -1);
                }
            }
            else {
                done = true;
            }
        } while (!done);
        if (word.length > 0 && StringUtil.containsAlphas(word)) {
            words.push(word);
        }
        start = end;
    } while (!sentenceEnded && start < text.length);

    return end;
}

function readDictionary(sourceLang, targetLang, filename) {
    var dict = new Dictionary(sourceLang, targetLang);
    console.log("Reading " + filename + "...")

    var startTime = new Date();
    var lineReader = new readlines(filename);

    let count = 0;
    let line;
    while (line = lineReader.next()) {
        line = line.toString().trim();
        if (line != "" && line[0] != '#')
        {
            let fields = line.split('\t');
            if (fields.length >= 2) {
                let wordType = (fields.length >= 3 ? fields[2] : "");
                if (dict.addEntry(fields[0], fields[1], wordType))
                    count++;
            }
        } 
    }

    var duration = new Date() - startTime;
    var durStr = (duration < 1000 ? duration.toString() + " ms"
                                  : (duration/1000).toString() + " seconds");

    console.log("Loaded " + count + " dictionary entries in " + durStr);
    return dict;
}


function init() {
    languages = new LanguageReader().readLanguages();
    var de_en = readDictionary("de", "en", "./dat/dict/de-en.txt");
    dictionaries["de-en"] = de_en;
    //de_en.addEntry("Hund", "dog");
}

// a simple lookup of a word
function lookup(dict, sourceLang, word) {
    var results = dict.lookup(word);
    if (results.length > 0) {
        var freq = sourceLang.getFrequencyRank(word);
        var inFrequencyList = freq <= sourceLang.getFrequencyListSize();
        for (let i = 0; i < results.length; i++) {
            results[i].frequency = freq;
            results[i].inFrequencyList = inFrequencyList;
        }
    }
    return results;
}

function lookupWordAndCanonicals(dict, sourceLang, word) {
    searched[word] = true;

    // first look up the word itself
    var meanings = lookup(dict, sourceLang, word);

    // now lookup and words that it might be a variant of
    for (let lastResort of [false, true]) {
        let canonicals = sourceLang.getCanonicals(word, lastResort);
        for (let c = 0; c < canonicals.length; c++) {
            let canonical = canonicals[c];
            let extras = lookup(dict, sourceLang, canonical);
            if (extras.length > 0) {
                meanings = meanings.concat(extras);
            }
        }
        // only go to last resort if nothing found beforehand
        if (meanings.length != 0)
            break;
    }

    return sortByFrequencyandQuality(meanings);
}

function findMeanings(word, tryOtherCases = true) {
    let meanings = lookupWordAndCanonicals(dictionary, sourceLang, word);
    if (!tryOtherCases)
        return meanings;

    if (anyBelowThreshold(freqThreshold, meanings)) {
        // stop here because we're going to throw this away anyway
        return meanings;
    }

    // may be uppercase because it starts a sentence
    // try to lookup word in lowercase
    let lower = word.toLowerCase();
    if (lower != word) {
        let lowerMeanings = lookupWordAndCanonicals(dictionary, sourceLang, lower);
        meanings = meanings.concat(lowerMeanings);
    }

    if (meanings.length == 0) {
        // try capitalising first letter
        let upper = StringUtil.capitalise(word);
        if (upper != word) {
            meanings = lookupWordAndCanonicals(dictionary, sourceLang, upper); 
        }
    }

    if (meanings.length == 0) {
        if (word.slice(-1) == "-")
            return findMeanings(word.slice(0,-1));
        else if (word.slice(0) == "-")
            return findMeanings(word.slice(1));
    }

    return meanings;
}

// returns a 2D array
function findMeaningsOfWordParts(word) {
    let results = [];
    let rest = word;
    let i = 1;

    let capitalise = false;
    if (sourceLang.code == "de") {
        let lower = word.toLowerCase();
        // compound words are normally nouns, which are capitalised in German.
        // the exception is large numbers
        if (!lower.includes("tausend") && !lower.includes("hundert"))
            capitalise = true;
    }
    while (i < rest.length - 1) {
        let searchTerm = rest.slice(i);
        if (capitalise)
            searchTerm = StringUtil.capitalise(searchTerm);
        let meanings = findMeanings(searchTerm, !capitalise);
        if (meanings.length == 0) {
            i++;
        }
        else {
            let goodOnes = [];
            for (let m of meanings) {
                if (m.key.length <= 3 && m.frequency >= 100000) {
                    // this is probably just noise
                    continue;
                }
                goodOnes.push(m);
            }

            if (goodOnes.length == 0) {
                i++;
            }
            else {
                results.unshift(goodOnes);
                rest = rest.slice(0, i);
                i = 0;
            }
        }
    }
    return results;
}

function handleSeparableVerb(sentenceWords, prefixPos)
{
    let prefix = sentenceWords[prefixPos].toLowerCase();

    // work backwards to find a possible suffix
    for (let i = prefixPos - 1; i >= 0; i--) {
        let suffix = sentenceWords[i].toLowerCase();
        let word = prefix + suffix;

        let entries = findMeanings(word, false);

        let results = [];
        for (let entry of entries) {
            // German infinitives end with "en"
            if (entry.key.endsWith("en"))
                results.push(entry);
        }

        if (results.length == 0)
            continue;

        // if we get here, we've got a hit
        // but do we want to keep it?

        let infinitive = results[0].key;

        if (searched[infinitive])
            return []

        if (sourceLang.getFrequencyRank(infinitive) <= freqThreshold)
            return [];

        let annotation = "(" + suffix + "..." + prefix + ") ";
        for (let res of results)
            res.source = annotation + res.source;

        return results;
    }

    // no hits
    return [];
}

function sortByFrequencyandQuality(entries)
{
    if (entries.length < 2)
        return entries;

    for (let entry of entries) {
        let src = entry.source;

        // does the meaning relate to a specific context?
        entry.specificTerm = (src.endsWith("]") && ! src.startsWith("["));
        entry.vulgar = (src.includes("vulg."));
        entry.defCount = entry.targets.length;

        entry.specificMeaning = true;
        for (let meaning of entry.targets) {
            if (!meaning.endsWith("]") || meaning.startsWith("[")) {
                entry.specificMeaning = false;
                break;
            }
        }

        if (entry.vulgar)
            entry.quality = 1;
        else if (entry.defCount >= 5)
            entry.quality = 10;
        else if (src.includes("<") && !entry.specificTerm)
            entry.quality = 10;
        else if (!entry.specificTerm && !entry.specificMeaning)
            entry.quality = 9;
        else if (!entry.specificTerm && entry.specificMeaning)
            entry.quality = 4;
        else if (entry.specificTerm && !entry.specificMeaning)
            entry.quality = 3;
        else if (entry.specificTerm && entry.specificMeaning)
            entry.quality = 2;
    }

    return entries.sort((a, b) => {
        if (a.frequency != b.frequency)
            return (a.frequency < b.frequency ? -1 : 1);
        else if (a.key != b.key)
            return (a.key < b.key ? -1 : 1);
        else if (a.quality != b.quality)
            return (a.quality > b.quality ? -1 : 1);
        else if (a.defCount != b.defCount)
            return (a.defCount > b.defCount ? -1 : 1);
        else
            return 0;
    });
}

function isDifferentWord(a, b) {
    return (a.key != b.key);
}

function filterResults(entries)
{
    if (entries.length < 2)
        return entries;
    
    // first one should be the best match, so always take it
    var filtered = [entries[0]];
    var bestQuality = entries[0].quality;
    var lastKept = entries[0];

    for (let i = 1; i < entries.length; i++) {
        let entry = entries[i];
        if (isDifferentWord(entry, lastKept)) {
            filtered.push(entry);
            bestQuality = entry.quality;
            lastKept = entry;
        }
        else {
            // another definition for the same word, but could be important enough to keep
            if (entry.quality == bestQuality || entry.quality >= 5) {
                filtered.push(entry);
                lastKept = entry;
            }
        }
    }
    return filtered;
}

function removeDuplicates(entries)
{
    let included = {};
    let results = [];
    for (let entry of entries) {
        let key = entry.wordType + ": " + entry.source;
        let previous = included[key];
        if (previous == null) {
            results.push(entry);
            included[key] = [entry];
        }
        else {
            let keep = true;
            for (let other of previous) {
                if (other.target == entry.target) {
                    keep = false;
                    break;
                }
            }
            if (keep) {
                results.push(entry);
                previous.push(entry);
            }
        }
    }
    return results;
}

function anyBelowThreshold(freqThreshold, meanings) {
    for (let m of meanings) {
        if (m.frequency <= freqThreshold)
            return true;
    }
    return false;
}

function process(requestData) {
    freqThreshold = requestData["freqThreshold"];
    if (freqThreshold >= 10000) {
        // ranks above 10,000 are expressed as >N
        freqThreshold -= 1;
    }

    var showAll = requestData["show_all"];
    var text = cleanText(requestData["text"]);

    var sourceLangCode = requestData["source_lang"];
    sourceLang = languages[sourceLangCode];
    if (sourceLang == null) {
        throw new Error("Language '" + sourceLangCode + "' unknown");
    }

    dictionary = dictionaries["de-en"];

    var results = [];
    searched = {};

    var pos = 0;
    while (pos < text.length) {
        let words = [];
        pos = getNextSentenceWords(text, pos, words);

        //let sentence = words.join(" ");
        //console.log(sentence);

        for (let i in words) {

            let word = words[i];
            let gotResults = false;

            let skip = false;
            if (searched[word])
                skip = true;
            else if (sourceLang.getFrequencyRank(word) <= freqThreshold)
                skip = true;

            let meanings = [];
            if (!skip) {
                meanings = findMeanings(word);
                if (meanings.length > 0) {
                    gotResults = true;;
                    if (anyBelowThreshold(freqThreshold, meanings))
                        meanings = [];
                }
            }

            if (sourceLang.isSeparablePrefix(word)) {
                let sepMeanings = handleSeparableVerb(words, i);
                if (sepMeanings.length > 0) {
                    gotResults = true;
                    if (!anyBelowThreshold(freqThreshold, sepMeanings))
                        meanings = meanings.concat(sepMeanings);
                }
            }

            if (!skip && !gotResults) {
                // try breaking word up
                let partMeanings = findMeaningsOfWordParts(word);
                gotResults = (partMeanings.length != 0);
                
                for (let m of partMeanings) {
                    if (!anyBelowThreshold(freqThreshold, m))
                        meanings = meanings.concat(m);
                }
            }

            if (showAll && !gotResults && !skip) {
                let entry = {key: word, source: word, targets:["???"]};
                entry.frequency = sourceLang.getFrequencyRank(word);
                meanings.push(entry);
            }
        
            results = results.concat(meanings);
        }
    }

    if (!showAll)
        results = filterResults(results);

    // concatenate meanings into a single string
    for (let res of results) {
        res.target = res.targets.join(", ");
    }

    results = removeDuplicates(results);

    // convert frequency to string
    for (let res of results) {

        if (res.frequency < 10000) {
            res.freq = res.frequency.toString();
        }
        else if (res.frequency == Language.RARE) {
            res.frequency = 100000;
            res.freq = (res.target == "???" ? "" : ">100000");
        }
        else {
            res.freq = ">" + res.frequency.toString();
        }
    }

    return results;
}

module.exports = {init, process};