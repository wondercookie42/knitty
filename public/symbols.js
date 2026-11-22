/* Built-in symbol library: what knitting chart symbols usually mean, and how each publishing convention draws them.
   Glyphs are drawn on a 28x28 cell (ops: L line, P polyline, C circle, D dot, U u-shape, T text) and turned into
   fingerprints by reader.js so a symbol found in a photo can be matched without asking the user.
   Sources: Craft Yarn Council "Knit chart symbols", Japanese JIS L 0201 conventions, German/Russian magazine charts
   (e.g. "1 M re", "1 Umschlag", "2 M re zusstr", "1 überz Abn"). Symbols differ by publisher: the chart's own key always wins. */
(function(){
var SETS={de:{en:'German-style chart',ru:'Немецкая схема'},jis:{en:'Japanese (JIS) chart',ru:'Японская схема (JIS)'},us:{en:'US/UK chart',ru:'Американская схема'}};
var bar=[['L',14,5,14,23]], dash=[['L',5,14,23,14]], dot=[['D',14,14,2.6]],
    uU=[['U']], ring=[['C',14,14,6]], slashR=[['L',6,22,22,6]], slashL=[['L',6,6,22,22]],
    vee2=[['P',[6,7],[14,22],[22,7]],['T','2',14,12]], vee3=[['P',[6,7],[14,22],[22,7]],['T','3',14,12]],
    downA=[['L',14,5,14,22],['P',[8,16],[14,22],[20,16]]], upA=[['L',14,23,14,6],['P',[8,12],[14,6],[20,12]]],
    leftWedge=[['P',[20,6],[8,14],[20,22]]], inc=[['L',14,6,14,18],['P',[5,20],[9,25],[19,25],[23,20]]],
    cross=[['L',6,6,22,22],['L',22,6,6,22]];
var ITEMS=[
 {id:'knit', io:[1,1], tok:'k', g:[['de',bar],['jis',bar]]},
 {id:'purl', io:[1,1], tok:'p', g:[['de',dash],['jis',dash],['us',dot]]},
 {id:'yo',   io:[0,1], tok:'yo', g:[['de',uU],['jis',ring],['us',ring]]},
 {id:'k2tog',io:[2,1], tok:'k2tog', g:[['de',vee2],['jis',slashR],['us',slashR]]},
 {id:'skp',  io:[2,1], tok:'skp', g:[['de',downA],['jis',slashL],['us',slashL]]},
 {id:'ktbl', io:[1,1], tok:'k', g:[['de',leftWedge]]},
 {id:'k3tog',io:[3,1], tok:'u', g:[['de',vee3]]},
 {id:'sk2p', io:[3,1], tok:'u', g:[['de',upA]]},
 {id:'inc3', io:[1/3,1], tok:'I', g:[['us',inc],['de',inc]]},
 {id:'cable',io:[1,1], tok:'u', g:[['us',cross]]}
];
window.SYMLIB={sets:SETS,items:ITEMS};
})();
