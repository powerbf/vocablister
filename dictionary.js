'use strict';

module.exports = class Dictionary {

    constructor(sourceLang, targetLang) {
        this.sourceLang = sourceLang;
        this.targetLang = targetLang;
        this.entries = {};
    }

    extractKey(str) {
        let result = "";
        let brackets = 0;
        let len = str.length;
        let last = ""
        for (let i = 0; i < len; i++) {
            let ch = str[i];
            if (ch == "[" || ch == "{" || ch == "(" || ch == "<")
                brackets++;
            else if (brackets == 0) {
                if (ch == " " && (last == " " || last == ""))
                    continue;
                result += ch;
                last = ch;
            }
            else if (ch == "]" || ch == "}" || ch == ")" || ch == ">")
                brackets--;
        }

        result = result.trim();
        if (result.includes(" ")) {
            if (result.includes(".")) {
                // remove annotations like sb., sth., etc.
                result = result.replace(/[^\s0-9]+\./g, "");
                result = result.trim();
            }
        }

        return result;
    }

    addEntry(source, target, wordType) {
        // source is the full source language entry, but key is stripped down
        var key = this.extractKey(source);
        if (key.length == 0) {
            //console.log("WARNING: zero-length key for: " + source);
            return false;
        }

        // ignore multi-word entries
        if (key.includes(" "))
            return false;

        var entry = {};
        entry["key"] = key;
        entry["source"] = source;
        entry["target"] = target;
        entry["wordType"] = wordType;

        if (!(key in this.entries))
            this.entries[key] = [];

        return this.entries[key].push(entry);
    }

    lookup(term) {
        var entries = this.entries[term];
        if (entries == null)
            return [];
        else {
            // consolidate
            let consolidated = {}; 
            for (let entry of entries) {
                let conKey = entry.wordType + ": " + entry.source;
                if (!(conKey in consolidated)) {
                    consolidated[conKey] = {key: term, source: entry.source, wordType: entry.wordType, targets:[]};
                }
                consolidated[conKey].targets.push(entry.target);
            }
            let results = [];
            for (let [conKey, entry] of Object.entries(consolidated)) {
                entry.targets = entry.targets.sort((a, b) => {
                    // put meaning without annotations first - they are likely to be more common
                    if (!a.includes("[") && b.includes("["))
                        return -1;
                    else if (a.includes("[") && !b.includes("["))
                        return 1;
                    else
                        return 0;
                });
                results.push(entry);
            }
            return results;
        }
    }
}