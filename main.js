'use strict';

const fs = require('fs');
const readlines = require('n-readlines');
var Dictionary = require('./dictionary.js');
var Language = require('./language.js');
var LanguageReader = require('./language-reader.js');

function isPunctuation(ch) {
    // basic latin
    if ((ch >= '\u0021' && ch <= '\u002F') || (ch >= '\u003A' && ch <= '\u0040')
            || (ch >= '\u005B' && ch <= '\u0060') || (ch >= '\u007B' && ch <= '\u007E'))
        return true;

    // latin extended A
    if ((ch >= '\u00A0' && ch <= '\u00BF') || ch == '\u00D7' || ch == '\u00F7')
        return true;

    // general punctuation
    if (ch >= '\u2000' && ch <= '\u206F')
        return true;
    
    // TODO: other punctuation
    return false;
}

function isWordPunctuation(ch) {
    return (ch == "'" || ch == '-' || ch == '.');
}

function isSentenceTerminator(ch) {
    return (ch == '.' || ch == '!' || ch == '?' || ch == ';')
}

function cleanText(text)
{
    var result = "";

    for (let i = 0; i < text.length; i++) {
        var ch = text[i];
        if (ch <= '\u001F' || ( ch >= '\u007F' && ch <= '\u009F')) {
            // replace control chars with spaces
            result += ' ';
        }
        else if (isPunctuation(ch)) {
            // only keep relevant punctuation
            result += (isSentenceTerminator(ch) || isWordPunctuation(ch) ? ch : ' ');
        }
        else if(ch == '\u00A0' || ch == '\u202F' || ch == '\u2007' || ch == '\u2060') {
            // replace non-breaking spaces with normal space
            result += ' ';
        }
        else {
            result += ch;
        }
    }

    // replace multiple spaces with a single space, and trim
    result = result.trim().replace(/ +/g, " ");

    return result;
}

// return array of sentence
function splitSentences(text) {
    var sentences = text.match(/[^\s].*?([\.\?!;]|$)/g);
    if (sentences == null)
        return [];
    else
        return sentences;
}

function splitWords(text) {
    var words = text.match(/[^ \.\?!;]+/g);
    if (words == null)
        return [];
    else
        return words;
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
                if (dict.addEntry(fields[0], fields[1]))
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

var languages = {};
var dictionaries = {};
function init() {
    languages = new LanguageReader().readLanguages();
    var de_en = readDictionary("de", "en", "./dat/dict/de-en.txt");
    dictionaries["de-en"] = de_en;
    //de_en.addEntry("Hund", "dog");
}

var lookedUp = {}

// a simple lookup of a word
function lookup(dict, sourceLang, word) {
    lookedUp[word] = true;
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

function sortByFrequencyandQuality(meanings)
{
    if (meanings.length < 2)
        return meanings;

    for (let entry of meanings) {
        // does the meaning relate to a specific context?
        entry.specific = (entry.source.match(/[^\s].*\[/) != null);
        // count definitions
        entry.defCount = (entry.target.match(/,/g) || []).length + 1;
    }

    return meanings.sort((a, b) => {
        if (a.frequency != b.frequency)
            return (a.frequency < b.frequency ? -1 : 1);
        else if (a.specific != b.specific)
            return (b.specific ? -1 : 1);
        else if (a.defCount != b.defCount)
            return (a.defCount > b.defCount ? -1 : 1);
        else
            return 0;
    });
}

function isDifferentWord(a, b) {
    if (a.frequency != b.frequency)
        return true;
    else if (a.isInFrequencyList)
        return false;
    else
        return (a.key != b.key);
}

function filterResults(entries)
{
    if (entries.length < 2)
        return entries;
    
    // first one should be the best match, so always take it
    var filtered = [entries[0]];
    var lastKept = entries[0];

    for (let i = 1; i < entries.length; i++) {
        let entry = entries[i];
        if (isDifferentWord(entry, lastKept)) {
            filtered.push(entry);
            lastKept = entry;
        }
        else {
            if (!entry.specific || entry.defCount >= 5) {
                filtered.push(entry);
                lastKept = entry;
            }
        }
    }
    return filtered;
}

function process(requestData) {
    var sourceLang = languages[requestData["source_lang"]];
    var freqThreshold = parseInt(requestData["freqThreshold"]);
    var showAll = (requestData["show_all"] == true);
    var text = cleanText(requestData["text"]);

    var dictionary = dictionaries["de-en"];

    var results = [];
    lookedUp = {};

    var sentences = splitSentences(text);
    for (let i = 0; i < sentences.length; i++) {
        console.log(i.toString() + ": " + sentences[i]);
        let words = splitWords(sentences[i]);
        for (let j = 0; j < words.length; j++) {
            let word = words[j];

            // ignore anything which is all numbers and/or punctuation
            if (word.match(/^[0-9\.,\?!\-]*$/))
                continue;

            if (lookedUp[word])
                continue;

            let meanings = lookup(dictionary, sourceLang, word);
            if (meanings.length > 0 && meanings[0].frequency <= freqThreshold)
                    continue;

            // may be uppercase because it starts a sentence
            // try to lookup up word in lowercase
            let lower = word.toLowerCase();
            let prevLookedUpLower = false;
            if (lower != word) {
                prevLookedUpLower = lookedUp[lower];
                if (!prevLookedUpLower) {
                    let lowerMeanings = lookup(dictionary, sourceLang, lower);
                    if (lowerMeanings.length > 0 && lowerMeanings[0].frequency <= freqThreshold)
                        continue;
                    meanings = meanings.concat(lowerMeanings);
                }
            }

            let canonicals = sourceLang.getCanonicals(word);
            for (let c = 0; c < canonicals.length; c++) {
                let canonical = canonicals[c];
                let extras = lookup(dictionary, sourceLang, canonical);
                if (extras.length > 0) {
                    //console.log("Adding results for " + canonical + " to results for " + word);
                    meanings = meanings.concat(extras);
                }
            }

            if (meanings.length == 0) {
                if (prevLookedUpLower || !showAll)
                    continue;
                let entry = {key: word, source: word, target:"???"};
                entry.frequency = sourceLang.getFrequencyRank(word);
                meanings.push(entry);
            }


            let ignore = false;
            for (var m of meanings) {
                if (m.frequency <= freqThreshold) {
                    ignore = true;
                    break;
                }
            }
            if (ignore)
                continue;
            results = results.concat(sortByFrequencyandQuality(meanings));
        }
    }

    // convert frequency to string
    // put X+ if it's not in the frequency list
    var numFreqs = sourceLang.getFrequencyListSize();
    for (var res of results) {
        if (res.frequency > numFreqs) {
            if (res.target == "???")
                res.freq = "";
            else
                res.freq = numFreqs.toString() + "+";
        }
        else
            res.freq = res.frequency.toString();
    }

    if (!showAll)
        results = filterResults(results);

    return results;
}

module.exports = {init, process};