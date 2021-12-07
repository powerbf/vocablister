'use strict';

module.exports = class Language {
    
    constructor(code) {
        this.code = code;
        // rules for transforming variants to canonical form, e.g. ".*st" -> ".*en"
        this.variantPatterns = [];
        // explicit variants that don't fit a pattern, like rennen -> rannte
        this.explicitVariants = {};
        this.frequency = {};
    }

    addVariantPattern(variant, canonical) {
        //canonical = new RegExp(canonical);
        variant = new RegExp(variant);

        var entry = { variant: variant, canonical: canonical };
        this.variantPatterns.push(entry);
    }

    addExplicitVariant(canonical, variant) {
        // we store with variant as key because we want to do reverse lookup
        if (!(variant in this.explicitVariants))
            this.explicitVariants[variant] = [];

        return this.explicitVariants[variant].push(canonical);
    }

    getCanonicals(word) {
        var canonicals = this.explicitVariants[word];
        if (typeof canonicals === 'undefined') {
            // no explicit variants
            canonicals = [];
        }
        else {
            // create a copy
            canonicals = canonicals.slice();
        }

        // derive canonicals from patterns
        this.variantPatterns.forEach(function (value, index, array) {
            let canonical = word.replace(value.variant, value.canonical);
             if (canonical != word && ! canonicals.includes(canonical)) {
                //console.log("Canonical: " + word + " -> " + canonical)
                canonicals.push(canonical);
            }
        });

        return canonicals;
    }

    addToFrequencyList(word) {
        // assign rank based on number of words already in the list
        this.frequency[word] = Object.keys(this.frequency).length;
    }

    getFrequencyRank(word) {
        var res = this.frequency[word];
        if (res == null)
            res = this.frequency[word.toLowerCase()];
        if (res == null) {
            //console.log("Frequency of " + word + " is null");
            return Number.MAX_VALUE;
        }
        //console.log("Frequency of " + word + " is " + res.toString());
        return res;
    }
}