import { internalMutation } from "./functions";

const COURSE_NAME = "Introduction to Python (CSEDM 2019 - A/B Groups)";

type SeedProblem = {
  tag: string;
  problem_name: string;
  week: number;
  knowledge_component: string;
  topic: string;
  problem_description: string;
  starter_code: string;
  solution_code: string;
  testCases: { input: string; expectedOutput: string }[];
};

// Original CSEDM 2019 Problems
const csedmProblems: SeedProblem[] = [
  {
    // CORRECTED: Original returns the string; seed version printed it and was named hello().
    tag: "csedm",
    problem_name: "helloWorld",
    week: 1,
    knowledge_component: "intro_setup",
    topic: "Introduction & Environment Setup",
    problem_description: "Write a function `helloWorld()` that returns the string 'Hello World!'.",
    starter_code: "def helloWorld():\n    pass",
    solution_code: "def helloWorld():\n    return 'Hello World!'",
    testCases: [
      { input: "", expectedOutput: "Hello World!" },
    ],
  },
  {
    tag: "csedm",
    problem_name: "intToFloat",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `intToFloat(x)` that takes an integer `x` and returns it as a floating point number.",
    starter_code: "def intToFloat(x):\n    pass",
    solution_code: "def intToFloat(x):\n    return float(x)",
    testCases: [
      { input: "5", expectedOutput: "5.0" },
      { input: "-10", expectedOutput: "-10.0" },
      { input: "0", expectedOutput: "0.0" },
    ],
  },
  {
    tag: "csedm",
    problem_name: "doubleX",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `doubleX(x)` that returns the given number multiplied by 2.",
    starter_code: "def doubleX(x):\n    pass",
    solution_code: "def doubleX(x):\n    return x * 2",
    testCases: [
      { input: "5", expectedOutput: "10" },
      { input: "0", expectedOutput: "0" },
      { input: "-3", expectedOutput: "-6" },
      { input: "2.5", expectedOutput: "5.0" },
    ],
  },
  {
    tag: "csedm",
    problem_name: "raiseToPower",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `raiseToPower(base, exponent)` that returns the `base` raised to the power of `exponent`.",
    starter_code: "def raiseToPower(base, exponent):\n    pass",
    solution_code: "def raiseToPower(base, exponent):\n    return base ** exponent",
    testCases: [
      { input: "2 3", expectedOutput: "8" },
      { input: "5 0", expectedOutput: "1" },
      { input: "10 -1", expectedOutput: "0.1" },
      { input: "-2 2", expectedOutput: "4" },
    ],
  },
  {
    // CORRECTED: Original uses math.degrees; seed used 3.14159. Rounding kept so floating-point output is stable.
    tag: "csedm",
    problem_name: "convertToDegrees",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `convertToDegrees(radians)` that converts an angle from radians to degrees and returns it rounded to 2 decimal places. Use `math.pi` or `math.degrees` (remember to `import math`).",
    starter_code: "def convertToDegrees(radians):\n    pass",
    solution_code: "import math\n\ndef convertToDegrees(radians):\n    return round(math.degrees(radians), 2)",
    testCases: [
      { input: "3.141592653589793", expectedOutput: "180.0" },
      { input: "1", expectedOutput: "57.3" },
      { input: "0", expectedOutput: "0.0" },
      { input: "1.5708", expectedOutput: "90.0" },
    ],
  },
  {
    tag: "csedm",
    problem_name: "leftoverCandy",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `leftoverCandy(candies, children)` that calculates how many candies are left over if they are divided equally among the children.",
    starter_code: "def leftoverCandy(candies, children):\n    pass",
    solution_code: "def leftoverCandy(candies, children):\n    return candies % children",
    testCases: [
      { input: "10 3", expectedOutput: "1" },
      { input: "15 5", expectedOutput: "0" },
      { input: "2 5", expectedOutput: "2" },
      { input: "100 7", expectedOutput: "2" },
    ],
  },
  {
    tag: "csedm",
    problem_name: "howManyEggCartons",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `howManyEggCartons(eggs)` that takes the total number of eggs and returns the number of 12-egg cartons needed to store them (a carton can be partially full).",
    starter_code: "def howManyEggCartons(eggs):\n    pass",
    solution_code: "def howManyEggCartons(eggs):\n    return (eggs + 11) // 12",
    testCases: [
      { input: "24", expectedOutput: "2" },
      { input: "25", expectedOutput: "3" },
      { input: "0", expectedOutput: "0" },
      { input: "1", expectedOutput: "1" },
    ],
  },
  {
    // CORRECTED: Original counts k from 1 (ones digit); seed counted from 0.
    tag: "csedm",
    problem_name: "kthDigit",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `kthDigit(x, k)` that takes a non-negative integer `x` and a positive integer `k`, and returns the k-th digit of `x` counting from the right, where k = 1 is the ones digit. If `x` has fewer than `k` digits, return 0.",
    starter_code: "def kthDigit(x, k):\n    pass",
    solution_code: "def kthDigit(x, k):\n    return (x // 10 ** (k - 1)) % 10",
    testCases: [
      { input: "1234, 1", expectedOutput: "4" },
      { input: "1234, 3", expectedOutput: "2" },
      { input: "507, 2", expectedOutput: "0" },
      { input: "9, 3", expectedOutput: "0" },
    ],
  },
  {
    // CORRECTED: Original: stops every 8 streets, ties go to the lower stop (inferred from correct solutions); seed used every 5.
    tag: "csedm",
    problem_name: "nearestBusStop",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Bus stops are on every 8th street (streets 0, 8, 16, 24, ...). Write a function `nearestBusStop(street)` that takes a non-negative integer street number and returns the street of the nearest bus stop. If the street is exactly halfway between two stops, return the lower one.",
    starter_code: "def nearestBusStop(street):\n    pass",
    solution_code: "def nearestBusStop(street):\n    return ((street + 3) // 8) * 8",
    testCases: [
      { input: "10", expectedOutput: "8" },
      { input: "13", expectedOutput: "16" },
      { input: "12", expectedOutput: "8" },
      { input: "0", expectedOutput: "0" },
      { input: "21", expectedOutput: "24" },
    ],
  },
  {
    tag: "csedm",
    problem_name: "hasTwoDigits",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `hasTwoDigits(n)` that returns True if the given positive integer `n` has exactly two digits, and False otherwise.",
    starter_code: "def hasTwoDigits(n):\n    pass",
    solution_code: "def hasTwoDigits(n):\n    return 10 <= n <= 99",
    testCases: [
      { input: "10", expectedOutput: "True" },
      { input: "99", expectedOutput: "True" },
      { input: "9", expectedOutput: "False" },
      { input: "100", expectedOutput: "False" },
    ],
  },
  {
    tag: "csedm",
    problem_name: "overNineThousand",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `overNineThousand(power_level)` that returns True if `power_level` is strictly greater than 9000, and False otherwise.",
    starter_code: "def overNineThousand(power_level):\n    pass",
    solution_code: "def overNineThousand(power_level):\n    return power_level > 9000",
    testCases: [
      { input: "9001", expectedOutput: "True" },
      { input: "9000", expectedOutput: "False" },
      { input: "8999", expectedOutput: "False" },
    ],
  },
  {
    // CORRECTED: Original takes (age, isDriving); seed only checked age.
    tag: "csedm",
    problem_name: "canDrinkAlcohol",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `canDrinkAlcohol(age, isDriving)` that returns True if a person may drink alcohol: they must be at least 21 years old and not driving. `isDriving` is a boolean.",
    starter_code: "def canDrinkAlcohol(age, isDriving):\n    pass",
    solution_code: "def canDrinkAlcohol(age, isDriving):\n    if age >= 21 and not isDriving:\n        return True\n    return False",
    testCases: [
      { input: "25, false", expectedOutput: "True" },
      { input: "25, true", expectedOutput: "False" },
      { input: "18, false", expectedOutput: "False" },
      { input: "21, false", expectedOutput: "True" },
    ],
  },
  {
    // CORRECTED: Original must also reject non-integers; seed did not.
    tag: "csedm",
    problem_name: "isEvenPositiveInt",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `isEvenPositiveInt(x)` that returns True if `x` is an integer that is both positive and even, and False otherwise. If `x` is not an integer (for example a string or a float), return False.",
    starter_code: "def isEvenPositiveInt(x):\n    pass",
    solution_code: "def isEvenPositiveInt(x):\n    if type(x) != int:\n        return False\n    return x > 0 and x % 2 == 0",
    testCases: [
      { input: "4", expectedOutput: "True" },
      { input: "7", expectedOutput: "False" },
      { input: "-2", expectedOutput: "False" },
      { input: "0", expectedOutput: "False" },
      { input: "\"8\"", expectedOutput: "False" },
      { input: "2.5", expectedOutput: "False" },
    ],
  },
  {
    // CORRECTED: Original is the larger quadratic root of (a, b, c); seed was math.sqrt(x).
    tag: "csedm",
    problem_name: "findRoot",
    week: 11,
    knowledge_component: "basic_libraries",
    topic: "Basic Libraries for Practical Tasks",
    problem_description: "Write a function `findRoot(a, b, c)` that returns the larger root of the quadratic equation ax\u00b2 + bx + c = 0, using the quadratic formula. You can assume `a` is not 0 and the equation has real roots. Use `math.sqrt` (remember to `import math`).",
    starter_code: "def findRoot(a, b, c):\n    pass",
    solution_code: "import math\n\ndef findRoot(a, b, c):\n    d = math.sqrt(b * b - 4 * a * c)\n    x1 = (-b + d) / (2 * a)\n    x2 = (-b - d) / (2 * a)\n    if x1 > x2:\n        return x1\n    return x2",
    testCases: [
      { input: "1, -3, 2", expectedOutput: "2.0" },
      { input: "1, 0, -9", expectedOutput: "3.0" },
      { input: "-1, 0, 4", expectedOutput: "2.0" },
      { input: "1, 2, 1", expectedOutput: "-1.0" },
    ],
  },
  {
    // CORRECTED: Original accepts any punctuation (string.punctuation); seed only . , ! ?
    tag: "csedm",
    problem_name: "isPunctuation",
    week: 3,
    knowledge_component: "strings_formatting",
    topic: "String and Formatting",
    problem_description: "Write a function `isPunctuation(c)` that takes a single character and returns True if it is a punctuation character (any character in `string.punctuation`, e.g. ! ? . , # @), and False otherwise. Remember to `import string`.",
    starter_code: "def isPunctuation(c):\n    pass",
    solution_code: "import string\n\ndef isPunctuation(c):\n    return c in string.punctuation",
    testCases: [
      { input: "\"!\"", expectedOutput: "True" },
      { input: "\"#\"", expectedOutput: "True" },
      { input: "\"a\"", expectedOutput: "False" },
      { input: "\" \"", expectedOutput: "False" },
      { input: "\"7\"", expectedOutput: "False" },
    ],
  },
  {
    tag: "csedm",
    problem_name: "firstAndLast",
    week: 3,
    knowledge_component: "strings_formatting",
    topic: "String and Formatting",
    problem_description: "Write a function `firstAndLast(s)` that takes a string `s` of at least length 1 and returns a new string containing only the first and last characters of `s`.",
    starter_code: "def firstAndLast(s):\n    pass",
    solution_code: "def firstAndLast(s):\n    if len(s) == 1:\n        return s + s\n    return s[0] + s[-1]",
    testCases: [
      { input: "[\"hello\"]", expectedOutput: "ho" },
      { input: "[\"world\"]", expectedOutput: "wd" },
      { input: "[\"a\"]", expectedOutput: "aa" },
      { input: "[\"ab\"]", expectedOutput: "ab" },
    ],
  },
  {
    // CORRECTED: Original is s2 + s1; seed reversed the characters instead.
    tag: "csedm",
    problem_name: "backwardsCombine",
    week: 3,
    knowledge_component: "strings_formatting",
    topic: "String and Formatting",
    problem_description: "Write a function `backwardsCombine(s1, s2)` that takes two strings and returns them joined in reverse order: `s2` followed by `s1`.",
    starter_code: "def backwardsCombine(s1, s2):\n    pass",
    solution_code: "def backwardsCombine(s1, s2):\n    return s2 + s1",
    testCases: [
      { input: "\"abc\", \"def\"", expectedOutput: "defabc" },
      { input: "\"Hello\", \"World\"", expectedOutput: "WorldHello" },
      { input: "\"\", \"x\"", expectedOutput: "x" },
    ],
  },
  {
    tag: "csedm",
    problem_name: "singlePigLatin",
    week: 3,
    knowledge_component: "strings_formatting",
    topic: "String and Formatting",
    problem_description: "Write a function `singlePigLatin(word)` that takes a lowercase word containing only letters. If the word starts with a vowel (a,e,i,o,u), return the word with 'yay' appended. Otherwise, move the first letter to the end and append 'ay'.",
    starter_code: "def singlePigLatin(word):\n    pass",
    solution_code: "def singlePigLatin(word):\n    vowels = 'aeiou'\n    if word[0] in vowels:\n        return word + 'yay'\n    else:\n        return word[1:] + word[0] + 'ay'",
    testCases: [
      { input: "[\"apple\"]", expectedOutput: "appleyay" },
      { input: "[\"banana\"]", expectedOutput: "ananabay" },
      { input: "[\"eat\"]", expectedOutput: "eatyay" },
      { input: "[\"hello\"]", expectedOutput: "ellohay" },
    ],
  },
  {
    // CORRECTED: Original builds a string with a loop; seed returned list(range()) with no loop.
    tag: "csedm",
    problem_name: "oneToN",
    week: 5,
    knowledge_component: "loops",
    topic: "Loops",
    problem_description: "Write a function `oneToN(n)` that returns a string of the numbers from 1 to `n` (inclusive) joined together with no spaces, e.g. oneToN(5) returns '12345'. If `n` is less than 1, return an empty string. Use a loop.",
    starter_code: "def oneToN(n):\n    pass",
    solution_code: "def oneToN(n):\n    result = ''\n    for i in range(1, n + 1):\n        result += str(i)\n    return result",
    testCases: [
      { input: "5", expectedOutput: "12345" },
      { input: "1", expectedOutput: "1" },
      { input: "12", expectedOutput: "123456789101112" },
      { input: "3", expectedOutput: "123" },
    ],
  },

];

// Supplementary Analogous Problems
const csedm2Problems: SeedProblem[] = [
  {
    tag: "csedm2",
    problem_name: "helloClass",
    week: 1,
    knowledge_component: "intro_setup",
    topic: "Introduction & Environment Setup",
    problem_description: "Write a function `helloClass()` that prints the string 'Hello Class!' to the console.",
    starter_code: "def helloClass():\n    pass",
    solution_code: "def helloClass():\n    print('Hello Class!')",
    testCases: [
      { input: "", expectedOutput: "Hello Class!" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "floatToInt",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `floatToInt(x)` that takes a floating point number `x` and returns it as an integer.",
    starter_code: "def floatToInt(x):\n    pass",
    solution_code: "def floatToInt(x):\n    return int(x)",
    testCases: [
      { input: "5.9", expectedOutput: "5" },
      { input: "-10.1", expectedOutput: "-10" },
      { input: "0.0", expectedOutput: "0" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "tripleX",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `tripleX(x)` that returns the given number multiplied by 3.",
    starter_code: "def tripleX(x):\n    pass",
    solution_code: "def tripleX(x):\n    return x * 3",
    testCases: [
      { input: "5", expectedOutput: "15" },
      { input: "0", expectedOutput: "0" },
      { input: "-3", expectedOutput: "-9" },
      { input: "2.5", expectedOutput: "7.5" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "sumOfSquares",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `sumOfSquares(a, b)` that returns the sum of the squares of `a` and `b`.",
    starter_code: "def sumOfSquares(a, b):\n    pass",
    solution_code: "def sumOfSquares(a, b):\n    return (a ** 2) + (b ** 2)",
    testCases: [
      { input: "2 3", expectedOutput: "13" },
      { input: "0 5", expectedOutput: "25" },
      { input: "-2 2", expectedOutput: "8" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "convertToRadians",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `convertToRadians(degrees)` that takes an angle in degrees and converts it to radians. (Assume pi = 3.14159, formula: radians = degrees * pi / 180, return rounded to 4 decimal places).",
    starter_code: "def convertToRadians(degrees):\n    pass",
    solution_code: "def convertToRadians(degrees):\n    return round(degrees * 3.14159 / 180, 4)",
    testCases: [
      { input: "180", expectedOutput: "3.1416" },
      { input: "90", expectedOutput: "1.5708" },
      { input: "0", expectedOutput: "0.0" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "remainingSlices",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `remainingSlices(slices, people)` that calculates how many pizza slices are left over if they are divided equally among the people.",
    starter_code: "def remainingSlices(slices, people):\n    pass",
    solution_code: "def remainingSlices(slices, people):\n    return slices % people",
    testCases: [
      { input: "10 3", expectedOutput: "1" },
      { input: "15 5", expectedOutput: "0" },
      { input: "8 5", expectedOutput: "3" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "howManyVans",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `howManyVans(people)` that takes the total number of people and returns the number of 8-person vans needed to transport them (a van can be partially full).",
    starter_code: "def howManyVans(people):\n    pass",
    solution_code: "def howManyVans(people):\n    return (people + 7) // 8",
    testCases: [
      { input: "16", expectedOutput: "2" },
      { input: "17", expectedOutput: "3" },
      { input: "0", expectedOutput: "0" },
      { input: "1", expectedOutput: "1" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "removeLastDigit",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "Write a function `removeLastDigit(n)` that returns the integer `n` with its rightmost digit removed. Assume `n` is non-negative.",
    starter_code: "def removeLastDigit(n):\n    pass",
    solution_code: "def removeLastDigit(n):\n    return n // 10",
    testCases: [
      { input: "1234", expectedOutput: "123" },
      { input: "9", expectedOutput: "0" },
      { input: "100", expectedOutput: "10" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "nearestWaterFountain",
    week: 2,
    knowledge_component: "variables_expressions",
    topic: "Variables and Expressions",
    problem_description: "There are water fountains every 10 meters (at meter 0, 10, 20, etc.). Write a function `nearestWaterFountain(position)` that takes a position in meters and returns the position of the nearest water fountain. If it's a tie, round up.",
    starter_code: "def nearestWaterFountain(position):\n    pass",
    solution_code: "def nearestWaterFountain(position):\n    return ((position + 5) // 10) * 10",
    testCases: [
      { input: "3", expectedOutput: "0" },
      { input: "8", expectedOutput: "10" },
      { input: "15", expectedOutput: "20" },
      { input: "20", expectedOutput: "20" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "hasThreeDigits",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `hasThreeDigits(n)` that returns True if the given positive integer `n` has exactly three digits, and False otherwise.",
    starter_code: "def hasThreeDigits(n):\n    pass",
    solution_code: "def hasThreeDigits(n):\n    return 100 <= n <= 999",
    testCases: [
      { input: "100", expectedOutput: "True" },
      { input: "999", expectedOutput: "True" },
      { input: "99", expectedOutput: "False" },
      { input: "1000", expectedOutput: "False" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "boilingPoint",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `boilingPoint(temp_celsius)` that returns True if `temp_celsius` is greater than or equal to 100, and False otherwise.",
    starter_code: "def boilingPoint(temp_celsius):\n    pass",
    solution_code: "def boilingPoint(temp_celsius):\n    return temp_celsius >= 100",
    testCases: [
      { input: "100", expectedOutput: "True" },
      { input: "105", expectedOutput: "True" },
      { input: "99", expectedOutput: "False" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "canVote",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `canVote(age)` that returns True if `age` is 18 or older, and False otherwise.",
    starter_code: "def canVote(age):\n    pass",
    solution_code: "def canVote(age):\n    return age >= 18",
    testCases: [
      { input: "18", expectedOutput: "True" },
      { input: "19", expectedOutput: "True" },
      { input: "17", expectedOutput: "False" },
      { input: "0", expectedOutput: "False" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "isOddNegativeInt",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `isOddNegativeInt(n)` that returns True if `n` is an odd negative integer (i.e. strictly less than 0 and not divisible by 2).",
    starter_code: "def isOddNegativeInt(n):\n    pass",
    solution_code: "def isOddNegativeInt(n):\n    return n < 0 and n % 2 != 0",
    testCases: [
      { input: "-3", expectedOutput: "True" },
      { input: "-1", expectedOutput: "True" },
      { input: "0", expectedOutput: "False" },
      { input: "-2", expectedOutput: "False" },
      { input: "3", expectedOutput: "False" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "findLog",
    week: 11,
    knowledge_component: "basic_libraries",
    topic: "Basic Libraries for Practical Tasks",
    problem_description: "Write a function `findLog(x)` that returns the base-10 logarithm of `x`. You must import the math module and use its log10 function.",
    starter_code: "def findLog(x):\n    pass",
    solution_code: "import math\ndef findLog(x):\n    return math.log10(x)",
    testCases: [
      { input: "10", expectedOutput: "1.0" },
      { input: "100", expectedOutput: "2.0" },
      { input: "1", expectedOutput: "0.0" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "isVowel",
    week: 3,
    knowledge_component: "strings_formatting",
    topic: "String and Formatting",
    problem_description: "Write a function `isVowel(c)` that takes a single character string and returns True if it is a lowercase vowel ('a', 'e', 'i', 'o', 'u'), and False otherwise.",
    starter_code: "def isVowel(c):\n    pass",
    solution_code: "def isVowel(c):\n    return c in ['a', 'e', 'i', 'o', 'u']",
    testCases: [
      { input: "[\"a\"]", expectedOutput: "True" },
      { input: "[\"e\"]", expectedOutput: "True" },
      { input: "[\"b\"]", expectedOutput: "False" },
      { input: "[\" \"]", expectedOutput: "False" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "firstThree",
    week: 3,
    knowledge_component: "strings_formatting",
    topic: "String and Formatting",
    problem_description: "Write a function `firstThree(s)` that takes a string `s` of at least length 3 and returns a new string containing only the first three characters of `s`.",
    starter_code: "def firstThree(s):\n    pass",
    solution_code: "def firstThree(s):\n    return s[:3]",
    testCases: [
      { input: "[\"hello\"]", expectedOutput: "hel" },
      { input: "[\"world\"]", expectedOutput: "wor" },
      { input: "[\"abc\"]", expectedOutput: "abc" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "reverseAndCapitalize",
    week: 3,
    knowledge_component: "strings_formatting",
    topic: "String and Formatting",
    problem_description: "Write a function `reverseAndCapitalize(s)` that takes a string, reverses it, and converts it entirely to uppercase.",
    starter_code: "def reverseAndCapitalize(s):\n    pass",
    solution_code: "def reverseAndCapitalize(s):\n    return s[::-1].upper()",
    testCases: [
      { input: "[\"abc\"]", expectedOutput: "CBA" },
      { input: "[\"hello\"]", expectedOutput: "OLLEH" },
      { input: "[\"a\"]", expectedOutput: "A" },
    ],
  },
  {
    tag: "csedm2",
    problem_name: "secretCode",
    week: 3,
    knowledge_component: "strings_formatting",
    topic: "String and Formatting",
    problem_description: "Write a function `secretCode(word)` that takes a string, reverses it, and appends 'xyz' to the end.",
    starter_code: "def secretCode(word):\n    pass",
    solution_code: "def secretCode(word):\n    return word[::-1] + 'xyz'",
    testCases: [
      { input: "[\"apple\"]", expectedOutput: "elppaxyz" },
      { input: "[\"cat\"]", expectedOutput: "tacxyz" },
      { input: "[\"a\"]", expectedOutput: "axyz" },
    ],
  },
  {
    // CORRECTED: Parallel of the corrected oneToN; seed returned list(range()) with no loop.
    tag: "csedm2",
    problem_name: "nToOne",
    week: 5,
    knowledge_component: "loops",
    topic: "Loops",
    problem_description: "Write a function `nToOne(n)` that returns a string of the numbers counting down from `n` to 1 joined together with no spaces, e.g. nToOne(5) returns '54321'. If `n` is less than 1, return an empty string. Use a loop.",
    starter_code: "def nToOne(n):\n    pass",
    solution_code: "def nToOne(n):\n    result = ''\n    for i in range(n, 0, -1):\n        result += str(i)\n    return result",
    testCases: [
      { input: "5", expectedOutput: "54321" },
      { input: "1", expectedOutput: "1" },
      { input: "12", expectedOutput: "121110987654321" },
      { input: "3", expectedOutput: "321" },
    ],
  },

];

// NEW: the CSEDM 2019 problems that were never seeded (only in MainTable.csv).
// Inputs and behaviour inferred from students' correct 2016 submissions;
// check descriptions against PSLC DataShop dataset 1798. Not included (no
// correct submissions, task unknown): createNumberBlock, treasureHunt,
// findTheCircle, friendOfFriends, mostAnagrams.
const csedmUnseededProblems: SeedProblem[] = [
  {
    // NEW
    tag: "csedm",
    problem_name: "isSubstring",
    week: 3,
    knowledge_component: "strings_formatting",
    topic: "String and Formatting",
    problem_description: "Write a function `isSubstring(s, t)` that returns True if `s` appears inside `t`. If either `s` or `t` is not a string, return False.",
    starter_code: "def isSubstring(s, t):\n    pass",
    solution_code: "def isSubstring(s, t):\n    return type(s) == str and type(t) == str and s in t",
    testCases: [
      { input: "\"cat\", \"concatenate\"", expectedOutput: "True" },
      { input: "\"dog\", \"concatenate\"", expectedOutput: "False" },
      { input: "5, \"12345\"", expectedOutput: "False" },
      { input: "\"\", \"abc\"", expectedOutput: "True" },
    ],
  },
  {
    // NEW
    tag: "csedm",
    problem_name: "stockChange",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `stockChange(percentChange)` that takes a stock's percentage change and returns 'Up' if it is positive, 'Down' if it is negative, and 'No Change' if it is zero.",
    starter_code: "def stockChange(percentChange):\n    pass",
    solution_code: "def stockChange(percentChange):\n    if percentChange > 0:\n        return 'Up'\n    elif percentChange < 0:\n        return 'Down'\n    else:\n        return 'No Change'",
    testCases: [
      { input: "2.5", expectedOutput: "Up" },
      { input: "-1", expectedOutput: "Down" },
      { input: "0", expectedOutput: "No Change" },
      { input: "0.01", expectedOutput: "Up" },
    ],
  },
  {
    // NEW
    tag: "csedm",
    problem_name: "carefulSquareRoot",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `carefulSquareRoot(x)` that returns the square root of `x`, or the string 'Error' if `x` is negative. Use `math.sqrt` (remember to `import math`).",
    starter_code: "def carefulSquareRoot(x):\n    pass",
    solution_code: "import math\n\ndef carefulSquareRoot(x):\n    if x < 0:\n        return 'Error'\n    return math.sqrt(x)",
    testCases: [
      { input: "16", expectedOutput: "4.0" },
      { input: "0", expectedOutput: "0.0" },
      { input: "-4", expectedOutput: "Error" },
      { input: "2", expectedOutput: "1.4142135623730951" },
    ],
  },
  {
    // NEW: Tests use '007' so returning the string and the number print differently.
    tag: "csedm",
    problem_name: "castString",
    week: 4,
    knowledge_component: "branching",
    topic: "Branching",
    problem_description: "Write a function `castString(s, asNumber)` that takes a string `s` containing a whole number and a boolean `asNumber`. If `asNumber` is True, return `s` converted to an integer; otherwise return `s` unchanged.",
    starter_code: "def castString(s, asNumber):\n    pass",
    solution_code: "def castString(s, asNumber):\n    if asNumber:\n        return int(s)\n    return s",
    testCases: [
      { input: "\"007\", true", expectedOutput: "7" },
      { input: "\"007\", false", expectedOutput: "007" },
      { input: "\"-12\", true", expectedOutput: "-12" },
      { input: "\"42\", false", expectedOutput: "42" },
    ],
  },
  {
    // NEW: Common 2016 solutions returned True for 1; the description now says 1 is not prime.
    tag: "csedm",
    problem_name: "isPrime",
    week: 5,
    knowledge_component: "loops",
    topic: "Loops",
    problem_description: "Write a function `isPrime(n)` that takes a positive integer `n` and returns True if it is prime and False otherwise. A prime number is greater than 1 and divisible only by 1 and itself, so 1 is not prime.",
    starter_code: "def isPrime(n):\n    pass",
    solution_code: "def isPrime(n):\n    if n < 2:\n        return False\n    for i in range(2, n):\n        if n % i == 0:\n            return False\n    return True",
    testCases: [
      { input: "7", expectedOutput: "True" },
      { input: "9", expectedOutput: "False" },
      { input: "2", expectedOutput: "True" },
      { input: "1", expectedOutput: "False" },
      { input: "97", expectedOutput: "True" },
    ],
  },
  {
    // NEW
    tag: "csedm",
    problem_name: "sumOfDigits",
    week: 5,
    knowledge_component: "loops",
    topic: "Loops",
    problem_description: "Write a function `sumOfDigits(n)` that takes a non-negative integer `n` and returns the sum of its digits, e.g. sumOfDigits(123) returns 6. Use a loop with % and //.",
    starter_code: "def sumOfDigits(n):\n    pass",
    solution_code: "def sumOfDigits(n):\n    total = 0\n    while n > 0:\n        total += n % 10\n        n //= 10\n    return total",
    testCases: [
      { input: "123", expectedOutput: "6" },
      { input: "0", expectedOutput: "0" },
      { input: "9999", expectedOutput: "36" },
      { input: "1050", expectedOutput: "6" },
    ],
  },
  {
    // NEW
    tag: "csedm",
    problem_name: "anyLowercase",
    week: 5,
    knowledge_component: "loops",
    topic: "Loops",
    problem_description: "Write a function `anyLowercase(s)` that returns True if the string `s` contains at least one lowercase letter, and False otherwise. Loop over the characters.",
    starter_code: "def anyLowercase(s):\n    pass",
    solution_code: "def anyLowercase(s):\n    for c in s:\n        if c.islower():\n            return True\n    return False",
    testCases: [
      { input: "\"HELLO\"", expectedOutput: "False" },
      { input: "\"HeLLO\"", expectedOutput: "True" },
      { input: "\"\"", expectedOutput: "False" },
      { input: "\"123abc\"", expectedOutput: "True" },
    ],
  },
  {
    // NEW: 2016 solutions were recursive (and gave 0 for factorial(0)); written here as a loop problem.
    tag: "csedm",
    problem_name: "factorial",
    week: 6,
    knowledge_component: "advanced_loops",
    topic: "Advanced Loops",
    problem_description: "Write a function `factorial(n)` that takes a non-negative integer `n` and returns n! (1 \u00d7 2 \u00d7 ... \u00d7 n). By definition, factorial(0) is 1.",
    starter_code: "def factorial(n):\n    pass",
    solution_code: "def factorial(n):\n    result = 1\n    for i in range(2, n + 1):\n        result *= i\n    return result",
    testCases: [
      { input: "5", expectedOutput: "120" },
      { input: "0", expectedOutput: "1" },
      { input: "1", expectedOutput: "1" },
      { input: "10", expectedOutput: "3628800" },
    ],
  },
  {
    // NEW: 2016 solutions were recursive with mixed indexing; this fixes fibonacci(0) = 0.
    tag: "csedm",
    problem_name: "fibonacci",
    week: 6,
    knowledge_component: "advanced_loops",
    topic: "Advanced Loops",
    problem_description: "Write a function `fibonacci(n)` that returns the n-th Fibonacci number, where fibonacci(0) is 0, fibonacci(1) is 1, and each later number is the sum of the two before it (0, 1, 1, 2, 3, 5, 8, ...).",
    starter_code: "def fibonacci(n):\n    pass",
    solution_code: "def fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a",
    testCases: [
      { input: "0", expectedOutput: "0" },
      { input: "1", expectedOutput: "1" },
      { input: "2", expectedOutput: "1" },
      { input: "7", expectedOutput: "13" },
      { input: "10", expectedOutput: "55" },
    ],
  },
  {
    // NEW: 2016 solutions were recursive; a while loop (Euclid) works equally.
    tag: "csedm",
    problem_name: "gcd",
    week: 6,
    knowledge_component: "advanced_loops",
    topic: "Advanced Loops",
    problem_description: "Write a function `gcd(x, y)` that takes two positive integers and returns their greatest common divisor, the largest number that divides both.",
    starter_code: "def gcd(x, y):\n    pass",
    solution_code: "def gcd(x, y):\n    while y != 0:\n        x, y = y, x % y\n    return x",
    testCases: [
      { input: "12, 18", expectedOutput: "6" },
      { input: "17, 5", expectedOutput: "1" },
      { input: "100, 75", expectedOutput: "25" },
      { input: "7, 7", expectedOutput: "7" },
    ],
  },
  {
    // NEW
    tag: "csedm",
    problem_name: "reduceToPositive",
    week: 9,
    knowledge_component: "collections",
    topic: "Collections",
    problem_description: "Write a function `reduceToPositive(l)` that takes a list of numbers and returns a new list containing only the numbers greater than 0, in their original order.",
    starter_code: "def reduceToPositive(l):\n    pass",
    solution_code: "def reduceToPositive(l):\n    result = []\n    for x in l:\n        if x > 0:\n            result.append(x)\n    return result",
    testCases: [
      { input: "[[1, -2, 3, 0, -5]]", expectedOutput: "[1, 3]" },
      { input: "[[-1, -2]]", expectedOutput: "[]" },
      { input: "[[4, 5]]", expectedOutput: "[4, 5]" },
      { input: "[[]]", expectedOutput: "[]" },
    ],
  },
  {
    // NEW: Even-length rule inferred from 2016 solutions; confirm against DataShop.
    tag: "csedm",
    problem_name: "middleElement",
    week: 9,
    knowledge_component: "collections",
    topic: "Collections",
    problem_description: "Write a function `middleElement(l)` that takes a non-empty list and returns its middle element. If the list has an even length, return the element just after the middle (the one at index len(l) // 2).",
    starter_code: "def middleElement(l):\n    pass",
    solution_code: "def middleElement(l):\n    return l[len(l) // 2]",
    testCases: [
      { input: "[[1, 2, 3]]", expectedOutput: "2" },
      { input: "[[5]]", expectedOutput: "5" },
      { input: "[[1, 2, 3, 4]]", expectedOutput: "3" },
      { input: "[[\"a\", \"b\", \"c\"]]", expectedOutput: "b" },
    ],
  },
  {
    // NEW
    tag: "csedm",
    problem_name: "secondHalf",
    week: 9,
    knowledge_component: "collections",
    topic: "Collections",
    problem_description: "Write a function `secondHalf(l)` that returns a new list with the second half of `l`. If the list has an odd length, include the middle element.",
    starter_code: "def secondHalf(l):\n    pass",
    solution_code: "def secondHalf(l):\n    return l[len(l) // 2:]",
    testCases: [
      { input: "[[1, 2, 3, 4]]", expectedOutput: "[3, 4]" },
      { input: "[[1, 2, 3, 4, 5]]", expectedOutput: "[3, 4, 5]" },
      { input: "[[7]]", expectedOutput: "[7]" },
      { input: "[[]]", expectedOutput: "[]" },
    ],
  },
  {
    // NEW: Uses nested loops and a set; placed in Collections rather than Advanced Loops because it needs lists.
    tag: "csedm",
    problem_name: "listOfLists",
    week: 9,
    knowledge_component: "collections",
    topic: "Collections",
    problem_description: "Write a function `listOfLists(l)` that takes a list of lists of numbers and returns a sorted list of every distinct number that appears in any of the inner lists.",
    starter_code: "def listOfLists(l):\n    pass",
    solution_code: "def listOfLists(l):\n    seen = set()\n    for inner in l:\n        for x in inner:\n            seen.add(x)\n    return sorted(seen)",
    testCases: [
      { input: "[[[3, 1], [2, 3], [1]]]", expectedOutput: "[1, 2, 3]" },
      { input: "[[[], [5]]]", expectedOutput: "[5]" },
      { input: "[[]]", expectedOutput: "[]" },
      { input: "[[[2, 2, 2]]]", expectedOutput: "[2]" },
    ],
  },
];

// ExemplAI-authored lessons (tag "exemplai") so that weeks 1, 5, 6, 8 and 9 have
// 7 lessons each: BKT grades only the first Submit per lesson, and 7 lets a
// student reach mastery (0.95) even after one fail at any point. Each lesson
// uses only Python features taught up to its week (server/ai/syllabus.py).
const exemplaiProblems: SeedProblem[] = [
  {
    tag: "exemplai",
    problem_name: "favouriteNumber",
    week: 1,
    knowledge_component: "intro_setup",
    topic: "Introduction & Environment Setup",
    problem_description: "Write a function `favouriteNumber()` that returns the number 7.",
    starter_code: "def favouriteNumber():\n    pass",
    solution_code: "def favouriteNumber():\n    return 7",
    testCases: [
      { input: "", expectedOutput: "7" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "courseCode",
    week: 1,
    knowledge_component: "intro_setup",
    topic: "Introduction & Environment Setup",
    problem_description: "Write a function `courseCode()` that returns the string 'COSC3104'.",
    starter_code: "def courseCode():\n    pass",
    solution_code: "def courseCode():\n    return 'COSC3104'",
    testCases: [
      { input: "", expectedOutput: "COSC3104" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "approximatePi",
    week: 1,
    knowledge_component: "intro_setup",
    topic: "Introduction & Environment Setup",
    problem_description: "Write a function `approximatePi()` that returns the number 3.14.",
    starter_code: "def approximatePi():\n    pass",
    solution_code: "def approximatePi():\n    return 3.14",
    testCases: [
      { input: "", expectedOutput: "3.14" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "printTwoLines",
    week: 1,
    knowledge_component: "intro_setup",
    topic: "Introduction & Environment Setup",
    problem_description: "Write a function `printTwoLines()` that prints 'Hello' on one line and 'World' on the next line.",
    starter_code: "def printTwoLines():\n    pass",
    solution_code: "def printTwoLines():\n    print('Hello')\n    print('World')",
    testCases: [
      { input: "", expectedOutput: "Hello\nWorld" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "printBox",
    week: 1,
    knowledge_component: "intro_setup",
    topic: "Introduction & Environment Setup",
    problem_description: "Write a function `printBox()` that prints this small box, one line at a time:\n\n```\n+---+\n|   |\n+---+\n```",
    starter_code: "def printBox():\n    pass",
    solution_code: "def printBox():\n    print('+---+')\n    print('|   |')\n    print('+---+')",
    testCases: [
      { input: "", expectedOutput: "+---+\n|   |\n+---+" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "countVowels",
    week: 5,
    knowledge_component: "loops",
    topic: "Loops",
    problem_description: "Write a function `countVowels(word)` that returns how many vowels (a, e, i, o, u) are in `word`, counting both lowercase and uppercase. Loop over the letters and keep a count.",
    starter_code: "def countVowels(word):\n    pass",
    solution_code: "def countVowels(word):\n    count = 0\n    for letter in word.lower():\n        if letter in 'aeiou':\n            count += 1\n    return count",
    testCases: [
      { input: "\"banana\"", expectedOutput: "3" },
      { input: "\"\"", expectedOutput: "0" },
      { input: "\"rhythm\"", expectedOutput: "0" },
      { input: "\"Education\"", expectedOutput: "5" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "sumMultiples",
    week: 5,
    knowledge_component: "loops",
    topic: "Loops",
    problem_description: "Write a function `sumMultiples(n)` that returns the sum of all the numbers from 1 up to (but not including) `n` that are divisible by 3 or by 5.",
    starter_code: "def sumMultiples(n):\n    pass",
    solution_code: "def sumMultiples(n):\n    total = 0\n    for k in range(1, n):\n        if k % 3 == 0 or k % 5 == 0:\n            total += k\n    return total",
    testCases: [
      { input: "10", expectedOutput: "23" },
      { input: "1", expectedOutput: "0" },
      { input: "16", expectedOutput: "60" },
      { input: "20", expectedOutput: "78" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "countSameParityPairs",
    week: 6,
    knowledge_component: "advanced_loops",
    topic: "Advanced Loops",
    problem_description: "Write a function `countSameParityPairs(n)` that counts the pairs of numbers (i, j) with 1 <= i < j <= n where i and j are both even or both odd. Use two loops, one inside the other.",
    starter_code: "def countSameParityPairs(n):\n    pass",
    solution_code: "def countSameParityPairs(n):\n    count = 0\n    for i in range(1, n + 1):\n        for j in range(i + 1, n + 1):\n            if i % 2 == j % 2:\n                count += 1\n    return count",
    testCases: [
      { input: "4", expectedOutput: "2" },
      { input: "5", expectedOutput: "4" },
      { input: "1", expectedOutput: "0" },
      { input: "6", expectedOutput: "6" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "firstRepeatedChar",
    week: 6,
    knowledge_component: "advanced_loops",
    topic: "Advanced Loops",
    problem_description: "Write a function `firstRepeatedChar(s)` that returns the first character of `s` that appears again later in the string, or an empty string if no character repeats. For example, firstRepeatedChar('hello') returns 'l'.",
    starter_code: "def firstRepeatedChar(s):\n    pass",
    solution_code: "def firstRepeatedChar(s):\n    for i in range(len(s)):\n        for j in range(i + 1, len(s)):\n            if s[i] == s[j]:\n                return s[i]\n    return ''",
    testCases: [
      { input: "\"hello\"", expectedOutput: "l" },
      { input: "\"abca\"", expectedOutput: "a" },
      { input: "\"python\"", expectedOutput: "" },
      { input: "\"aabb\"", expectedOutput: "a" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "countPrimesUpTo",
    week: 6,
    knowledge_component: "advanced_loops",
    topic: "Advanced Loops",
    problem_description: "Write a function `countPrimesUpTo(n)` that returns how many prime numbers there are from 2 up to `n` (inclusive). For each number, use an inner loop to look for a divisor and `break` as soon as you find one.",
    starter_code: "def countPrimesUpTo(n):\n    pass",
    solution_code: "def countPrimesUpTo(n):\n    count = 0\n    for k in range(2, n + 1):\n        is_prime = True\n        for d in range(2, k):\n            if k % d == 0:\n                is_prime = False\n                break\n        if is_prime:\n            count += 1\n    return count",
    testCases: [
      { input: "10", expectedOutput: "4" },
      { input: "2", expectedOutput: "1" },
      { input: "1", expectedOutput: "0" },
      { input: "20", expectedOutput: "8" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "digitalRoot",
    week: 6,
    knowledge_component: "advanced_loops",
    topic: "Advanced Loops",
    problem_description: "Write a function `digitalRoot(n)` that takes a non-negative integer and keeps adding up its digits until only one digit is left, then returns it. For example, 942 gives 9 + 4 + 2 = 15, then 1 + 5 = 6, so digitalRoot(942) returns 6.",
    starter_code: "def digitalRoot(n):\n    pass",
    solution_code: "def digitalRoot(n):\n    while n >= 10:\n        total = 0\n        while n > 0:\n            total += n % 10\n            n //= 10\n        n = total\n    return n",
    testCases: [
      { input: "942", expectedOutput: "6" },
      { input: "16", expectedOutput: "7" },
      { input: "0", expectedOutput: "0" },
      { input: "9875", expectedOutput: "2" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "greet",
    week: 8,
    knowledge_component: "functions",
    topic: "Functions",
    problem_description: "Write a function `greet(name, greeting=\"Hello\")` that returns a greeting such as 'Hello, Ana!'. The `greeting` parameter is optional and defaults to \"Hello\".",
    starter_code: "def greet(name, greeting=\"Hello\"):\n    pass",
    solution_code: "def greet(name, greeting=\"Hello\"):\n    return f\"{greeting}, {name}!\"",
    testCases: [
      { input: "\"Ana\"", expectedOutput: "Hello, Ana!" },
      { input: "\"Ana\", \"Hi\"", expectedOutput: "Hi, Ana!" },
      { input: "\"Minh\", \"Xin chao\"", expectedOutput: "Xin chao, Minh!" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "power",
    week: 8,
    knowledge_component: "functions",
    topic: "Functions",
    problem_description: "Write a function `power(base, exponent=2)` that returns `base` raised to `exponent`. If no exponent is given, it squares the number.",
    starter_code: "def power(base, exponent=2):\n    pass",
    solution_code: "def power(base, exponent=2):\n    return base ** exponent",
    testCases: [
      { input: "3", expectedOutput: "9" },
      { input: "2, 5", expectedOutput: "32" },
      { input: "10, 0", expectedOutput: "1" },
      { input: "-4", expectedOutput: "16" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "countEvens",
    week: 8,
    knowledge_component: "functions",
    topic: "Functions",
    problem_description: "Write a helper function `isEven(n)` that returns True if `n` is even, then use it in `countEvens(a, b)`, which returns how many even numbers there are from `a` to `b` (inclusive).",
    starter_code: "def countEvens(a, b):\n    pass\n\n\ndef isEven(n):\n    pass",
    solution_code: "def countEvens(a, b):\n    count = 0\n    for n in range(a, b + 1):\n        if isEven(n):\n            count += 1\n    return count\n\n\ndef isEven(n):\n    return n % 2 == 0",
    testCases: [
      { input: "1, 10", expectedOutput: "5" },
      { input: "2, 2", expectedOutput: "1" },
      { input: "3, 3", expectedOutput: "0" },
      { input: "0, 6", expectedOutput: "4" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "maxOfThree",
    week: 8,
    knowledge_component: "functions",
    topic: "Functions",
    problem_description: "Write a helper function `maxOfTwo(x, y)` that returns the larger of two numbers, then use it in `maxOfThree(a, b, c)`, which returns the largest of three numbers. Don't use the built-in max().",
    starter_code: "def maxOfThree(a, b, c):\n    pass\n\n\ndef maxOfTwo(x, y):\n    pass",
    solution_code: "def maxOfThree(a, b, c):\n    return maxOfTwo(maxOfTwo(a, b), c)\n\n\ndef maxOfTwo(x, y):\n    if x > y:\n        return x\n    return y",
    testCases: [
      { input: "3, 7, 5", expectedOutput: "7" },
      { input: "-1, -5, -3", expectedOutput: "-1" },
      { input: "4, 4, 2", expectedOutput: "4" },
      { input: "1, 2, 9", expectedOutput: "9" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "describeTemperature",
    week: 8,
    knowledge_component: "functions",
    topic: "Functions",
    problem_description: "Write a helper function `toFahrenheit(celsius)` that returns celsius * 9 / 5 + 32, then use it in `describeTemperature(celsius)`, which returns 'hot' if the temperature is at least 86\u00b0F, 'cold' if it is below 50\u00b0F, and 'mild' otherwise.",
    starter_code: "def describeTemperature(celsius):\n    pass\n\n\ndef toFahrenheit(celsius):\n    pass",
    solution_code: "def describeTemperature(celsius):\n    f = toFahrenheit(celsius)\n    if f >= 86:\n        return 'hot'\n    if f < 50:\n        return 'cold'\n    return 'mild'\n\n\ndef toFahrenheit(celsius):\n    return celsius * 9 / 5 + 32",
    testCases: [
      { input: "35", expectedOutput: "hot" },
      { input: "5", expectedOutput: "cold" },
      { input: "20", expectedOutput: "mild" },
      { input: "30", expectedOutput: "hot" },
      { input: "10", expectedOutput: "mild" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "safeDivide",
    week: 8,
    knowledge_component: "functions",
    topic: "Functions",
    problem_description: "Write a function `safeDivide(a, b)` that returns `a` divided by `b`, or the string 'undefined' if `b` is 0. Make sure every path through your function returns a value.",
    starter_code: "def safeDivide(a, b):\n    pass",
    solution_code: "def safeDivide(a, b):\n    if b == 0:\n        return 'undefined'\n    return a / b",
    testCases: [
      { input: "10, 2", expectedOutput: "5.0" },
      { input: "7, 0", expectedOutput: "undefined" },
      { input: "9, 3", expectedOutput: "3.0" },
      { input: "0, 5", expectedOutput: "0.0" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "compoundInterest",
    week: 8,
    knowledge_component: "functions",
    topic: "Functions",
    problem_description: "Write a function `compoundInterest(principal, rate, years=1)` that returns the balance after `years` years when `principal` grows by `rate` percent each year, rounded to 2 decimal places. `years` is optional and defaults to 1.",
    starter_code: "def compoundInterest(principal, rate, years=1):\n    pass",
    solution_code: "def compoundInterest(principal, rate, years=1):\n    return round(principal * (1 + rate / 100) ** years, 2)",
    testCases: [
      { input: "1000, 5", expectedOutput: "1050.0" },
      { input: "1000, 5, 2", expectedOutput: "1102.5" },
      { input: "500, 10, 3", expectedOutput: "665.5" },
      { input: "200, 0, 4", expectedOutput: "200.0" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "mostCommonWord",
    week: 9,
    knowledge_component: "collections",
    topic: "Collections",
    problem_description: "Write a function `mostCommonWord(sentence)` that returns the word that appears most often in `sentence` (words are separated by spaces). If several words tie, return the one that appears first. Use a dictionary to count the words.",
    starter_code: "def mostCommonWord(sentence):\n    pass",
    solution_code: "def mostCommonWord(sentence):\n    counts = {}\n    for word in sentence.split():\n        counts[word] = counts.get(word, 0) + 1\n    best = ''\n    for word in sentence.split():\n        if best == '' or counts[word] > counts[best]:\n            best = word\n    return best",
    testCases: [
      { input: "\"the cat and the hat\"", expectedOutput: "the" },
      { input: "\"a b b a c\"", expectedOutput: "a" },
      { input: "\"one\"", expectedOutput: "one" },
      { input: "\"x y z y\"", expectedOutput: "y" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "uniqueCount",
    week: 9,
    knowledge_component: "collections",
    topic: "Collections",
    problem_description: "Write a function `uniqueCount(values)` that takes a list and returns how many different values it contains. Use a set.",
    starter_code: "def uniqueCount(values):\n    pass",
    solution_code: "def uniqueCount(values):\n    return len(set(values))",
    testCases: [
      { input: "[[1, 2, 2, 3]]", expectedOutput: "3" },
      { input: "[[]]", expectedOutput: "0" },
      { input: "[[\"a\", \"a\", \"b\"]]", expectedOutput: "2" },
      { input: "[[5, 5, 5, 5]]", expectedOutput: "1" },
    ],
  },
  {
    tag: "exemplai",
    problem_name: "minMax",
    week: 9,
    knowledge_component: "collections",
    topic: "Collections",
    problem_description: "Write a function `minMax(values)` that takes a non-empty list of numbers and returns a tuple (smallest, largest).",
    starter_code: "def minMax(values):\n    pass",
    solution_code: "def minMax(values):\n    smallest = values[0]\n    largest = values[0]\n    for v in values:\n        if v < smallest:\n            smallest = v\n        if v > largest:\n            largest = v\n    return (smallest, largest)",
    testCases: [
      { input: "[[3, 1, 9, 4]]", expectedOutput: "(1, 9)" },
      { input: "[[5]]", expectedOutput: "(5, 5)" },
      { input: "[[-2, -7]]", expectedOutput: "(-7, -2)" },
      { input: "[[0, 10, 10]]", expectedOutput: "(0, 10)" },
    ],
  },
];

// Upsert: creates the course if needed, inserts lessons missing from it and
// overwrites the content of existing ones (matched by problem_name) so their
// ids, and any progress pointing at them, are kept.
export const seedQuestions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("course").collect();
    const courseId =
      existing.find((c) => c.course_name === COURSE_NAME)?._id ??
      (await ctx.db.insert("course", {
        course_name: COURSE_NAME,
        course_language: "Python",
      }));

    const current = await ctx.db
      .query("questions")
      .withIndex("by_course", (q) => q.eq("course", courseId))
      .collect();
    const byName = new Map(current.map((q) => [q.problem_name, q._id]));

    let insertedCount = 0;
    let updatedCount = 0;
    for (const problem of [
      ...csedmProblems,
      ...csedm2Problems,
      ...csedmUnseededProblems,
      ...exemplaiProblems,
    ]) {
      const fields = {
        week: problem.week,
        course: courseId,
        problem_name: problem.problem_name,
        problem_description: problem.problem_description,
        knowledge_component: problem.knowledge_component,
        topic: problem.topic,
        tag: problem.tag,
        starter_code: problem.starter_code,
        solution_code: problem.solution_code,
        testCases: problem.testCases,
      };
      const id = byName.get(problem.problem_name);
      if (id) {
        await ctx.db.patch(id, fields);
        updatedCount++;
      } else {
        await ctx.db.insert("questions", fields);
        insertedCount++;
      }
    }

    return { success: true, courseId, insertedCount, updatedCount };
  },
});

// Wipes every course, lesson and per-lesson activity row (progress, BKT
// mastery, chats, messages). Users, profiles, invitation codes, auth tables
// and release notes are kept; users only lose their last_opened_lesson
// pointer, which would otherwise dangle.
export const resetCourseData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const deleted: Record<string, number> = {};
    for (const table of [
      "chatMessages",
      "chats",
      "lessonProgress",
      "bktMastery",
      "questions",
      "course",
    ] as const) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) await ctx.db.delete(row._id);
      deleted[table] = rows.length;
    }

    let usersCleared = 0;
    for (const user of await ctx.db.query("users").collect()) {
      if (user.last_opened_lesson !== undefined) {
        await ctx.db.patch(user._id, { last_opened_lesson: undefined });
        usersCleared++;
      }
    }

    return { deleted, usersCleared };
  },
});
