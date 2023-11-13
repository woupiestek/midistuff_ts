export class XMLPrinter {
  // params.

  pop() {
    return {
      "score-partwise": {
        "@version": 4.0,
        "part-list": {
          "score-part": [
            { "@id": "P1", "part-name": "Untitled" },
            { "@id": "P2", "part-name": "Untitled" },
          ],
        },
        part: [],
      },
    };
  }
}
