import { mutation } from "./_generated/server";

// Original CSEDM 2019 Problems
const csedmProblems = [
  {
    tag: "csedm",
    problem_name: "helloWorld",
    week: 1,
    knowledge_component: "io_basics",
    topic: "I/O Basics",
    problem_description: "Write a function `hello()` that prints the string 'Hello World!' to the console.",
    starter_code: "def hello():\n    pass",
    unit_tests: "import sys, io\nout = io.StringIO()\nsys.stdout = out\nhello()\nsys.stdout = sys.__stdout__\nassert out.getvalue().strip() == 'Hello World!'",
    solution: "def hello():\n    print('Hello World!')"
  },
  {
    tag: "csedm",
    problem_name: "intToFloat",
    week: 2,
    knowledge_component: "io_basics",
    topic: "I/O Basics",
    problem_description: "Write a function `intToFloat(x)` that takes an integer `x` and returns it as a floating point number.",
    starter_code: "def intToFloat(x):\n    pass",
    unit_tests: "assert type(intToFloat(5)) == float\nassert intToFloat(5) == 5.0\nassert intToFloat(-10) == -10.0\nassert intToFloat(0) == 0.0",
    solution: "def intToFloat(x):\n    return float(x)"
  },
  {
    tag: "csedm",
    problem_name: "doubleX",
    week: 2,
    knowledge_component: "io_basics",
    topic: "I/O Basics",
    problem_description: "Write a function `doubleX(x)` that returns the given number multiplied by 2.",
    starter_code: "def doubleX(x):\n    pass",
    unit_tests: "assert doubleX(5) == 10\nassert doubleX(0) == 0\nassert doubleX(-3) == -6\nassert doubleX(2.5) == 5.0",
    solution: "def doubleX(x):\n    return x * 2"
  },
  {
    tag: "csedm",
    problem_name: "raiseToPower",
    week: 2,
    knowledge_component: "arithmetic",
    topic: "Arithmetic",
    problem_description: "Write a function `raiseToPower(base, exponent)` that returns the `base` raised to the power of `exponent`.",
    starter_code: "def raiseToPower(base, exponent):\n    pass",
    unit_tests: "assert raiseToPower(2, 3) == 8\nassert raiseToPower(5, 0) == 1\nassert raiseToPower(10, -1) == 0.1\nassert raiseToPower(-2, 2) == 4",
    solution: "def raiseToPower(base, exponent):\n    return base ** exponent"
  },
  {
    tag: "csedm",
    problem_name: "convertToDegrees",
    week: 2,
    knowledge_component: "arithmetic",
    topic: "Arithmetic",
    problem_description: "Write a function `convertToDegrees(radians)` that takes an angle in radians and converts it to degrees. (Assume pi = 3.14159, formula: degrees = radians * 180 / pi, return rounded to 2 decimal places).",
    starter_code: "def convertToDegrees(radians):\n    pass",
    unit_tests: "assert convertToDegrees(3.14159) == 180.0\nassert convertToDegrees(1.570795) == 90.0\nassert convertToDegrees(0) == 0.0",
    solution: "def convertToDegrees(radians):\n    return round(radians * 180 / 3.14159, 2)"
  },
  {
    tag: "csedm",
    problem_name: "leftoverCandy",
    week: 2,
    knowledge_component: "modular_arith",
    topic: "Modular Arithmetic",
    problem_description: "Write a function `leftoverCandy(candies, children)` that calculates how many candies are left over if they are divided equally among the children.",
    starter_code: "def leftoverCandy(candies, children):\n    pass",
    unit_tests: "assert leftoverCandy(10, 3) == 1\nassert leftoverCandy(15, 5) == 0\nassert leftoverCandy(2, 5) == 2\nassert leftoverCandy(100, 7) == 2",
    solution: "def leftoverCandy(candies, children):\n    return candies % children"
  },
  {
    tag: "csedm",
    problem_name: "howManyEggCartons",
    week: 2,
    knowledge_component: "modular_arith",
    topic: "Modular Arithmetic",
    problem_description: "Write a function `howManyEggCartons(eggs)` that takes the total number of eggs and returns the number of 12-egg cartons needed to store them (a carton can be partially full).",
    starter_code: "def howManyEggCartons(eggs):\n    pass",
    unit_tests: "assert howManyEggCartons(24) == 2\nassert howManyEggCartons(25) == 3\nassert howManyEggCartons(0) == 0\nassert howManyEggCartons(1) == 1",
    solution: "def howManyEggCartons(eggs):\n    return (eggs + 11) // 12"
  },
  {
    tag: "csedm",
    problem_name: "kthDigit",
    week: 2,
    knowledge_component: "modular_arith",
    topic: "Modular Arithmetic",
    problem_description: "Write a function `kthDigit(n, k)` that returns the k-th digit of the integer `n` from the right (0-indexed, so k=0 is the last digit). If `k` is out of bounds, return 0. Assume `n` is non-negative.",
    starter_code: "def kthDigit(n, k):\n    pass",
    unit_tests: "assert kthDigit(1234, 0) == 4\nassert kthDigit(1234, 1) == 3\nassert kthDigit(1234, 3) == 1\nassert kthDigit(1234, 5) == 0",
    solution: "def kthDigit(n, k):\n    return (n // (10**k)) % 10"
  },
  {
    tag: "csedm",
    problem_name: "nearestBusStop",
    week: 2,
    knowledge_component: "modular_arith",
    topic: "Modular Arithmetic",
    problem_description: "There are bus stops every 5 blocks (at block 0, 5, 10, etc.). Write a function `nearestBusStop(street)` that takes a street block number and returns the street block of the nearest bus stop. If it's a tie, round up to the nearest one.",
    starter_code: "def nearestBusStop(street):\n    pass",
    unit_tests: "assert nearestBusStop(3) == 5\nassert nearestBusStop(2) == 0\nassert nearestBusStop(7) == 5\nassert nearestBusStop(8) == 10\nassert nearestBusStop(10) == 10",
    solution: "def nearestBusStop(street):\n    return ((street + 2) // 5) * 5"
  },
  {
    tag: "csedm",
    problem_name: "hasTwoDigits",
    week: 4,
    knowledge_component: "conditionals",
    topic: "Conditionals",
    problem_description: "Write a function `hasTwoDigits(n)` that returns True if the given positive integer `n` has exactly two digits, and False otherwise.",
    starter_code: "def hasTwoDigits(n):\n    pass",
    unit_tests: "assert hasTwoDigits(10) == True\nassert hasTwoDigits(99) == True\nassert hasTwoDigits(9) == False\nassert hasTwoDigits(100) == False",
    solution: "def hasTwoDigits(n):\n    return 10 <= n <= 99"
  },
  {
    tag: "csedm",
    problem_name: "overNineThousand",
    week: 4,
    knowledge_component: "conditionals",
    topic: "Conditionals",
    problem_description: "Write a function `overNineThousand(power_level)` that returns True if `power_level` is strictly greater than 9000, and False otherwise.",
    starter_code: "def overNineThousand(power_level):\n    pass",
    unit_tests: "assert overNineThousand(9001) == True\nassert overNineThousand(9000) == False\nassert overNineThousand(8999) == False",
    solution: "def overNineThousand(power_level):\n    return power_level > 9000"
  },
  {
    tag: "csedm",
    problem_name: "canDrinkAlcohol",
    week: 4,
    knowledge_component: "conditionals",
    topic: "Conditionals",
    problem_description: "Write a function `canDrinkAlcohol(age)` that returns True if `age` is 21 or older, and False otherwise.",
    starter_code: "def canDrinkAlcohol(age):\n    pass",
    unit_tests: "assert canDrinkAlcohol(21) == True\nassert canDrinkAlcohol(22) == True\nassert canDrinkAlcohol(20) == False\nassert canDrinkAlcohol(0) == False",
    solution: "def canDrinkAlcohol(age):\n    return age >= 21"
  },
  {
    tag: "csedm",
    problem_name: "isEvenPositiveInt",
    week: 4,
    knowledge_component: "conditionals",
    topic: "Conditionals",
    problem_description: "Write a function `isEvenPositiveInt(n)` that returns True if `n` is an even positive integer (i.e. strictly greater than 0 and divisible by 2).",
    starter_code: "def isEvenPositiveInt(n):\n    pass",
    unit_tests: "assert isEvenPositiveInt(2) == True\nassert isEvenPositiveInt(10) == True\nassert isEvenPositiveInt(0) == False\nassert isEvenPositiveInt(-2) == False\nassert isEvenPositiveInt(3) == False",
    solution: "def isEvenPositiveInt(n):\n    return n > 0 and n % 2 == 0"
  },
  {
    tag: "csedm",
    problem_name: "findRoot",
    week: 8,
    knowledge_component: "functions_params",
    topic: "Functions and Parameters",
    problem_description: "Write a function `findRoot(x)` that returns the square root of `x`. You must import the math module and use its sqrt function.",
    starter_code: "def findRoot(x):\n    pass",
    unit_tests: "assert findRoot(4) == 2.0\nassert findRoot(9) == 3.0\nassert findRoot(0) == 0.0\nassert findRoot(25) == 5.0",
    solution: "import math\ndef findRoot(x):\n    return math.sqrt(x)"
  },
  {
    tag: "csedm",
    problem_name: "isPunctuation",
    week: 3,
    knowledge_component: "string_manip",
    topic: "String Manipulation",
    problem_description: "Write a function `isPunctuation(c)` that takes a single character string and returns True if it is one of the following punctuation marks: '.', ',', '!', '?', and False otherwise.",
    starter_code: "def isPunctuation(c):\n    pass",
    unit_tests: "assert isPunctuation('.') == True\nassert isPunctuation('?') == True\nassert isPunctuation('a') == False\nassert isPunctuation(' ') == False\nassert isPunctuation('-') == False",
    solution: "def isPunctuation(c):\n    return c in ['.', ',', '!', '?']"
  },
  {
    tag: "csedm",
    problem_name: "firstAndLast",
    week: 3,
    knowledge_component: "string_manip",
    topic: "String Manipulation",
    problem_description: "Write a function `firstAndLast(s)` that takes a string `s` of at least length 1 and returns a new string containing only the first and last characters of `s`.",
    starter_code: "def firstAndLast(s):\n    pass",
    unit_tests: "assert firstAndLast('hello') == 'ho'\nassert firstAndLast('world') == 'wd'\nassert firstAndLast('a') == 'aa'\nassert firstAndLast('ab') == 'ab'",
    solution: "def firstAndLast(s):\n    if len(s) == 1:\n        return s + s\n    return s[0] + s[-1]"
  },
  {
    tag: "csedm",
    problem_name: "backwardsCombine",
    week: 3,
    knowledge_component: "string_manip",
    topic: "String Manipulation",
    problem_description: "Write a function `backwardsCombine(s1, s2)` that takes two strings, concatenates `s2` to `s1`, and returns the resulting string in reverse order.",
    starter_code: "def backwardsCombine(s1, s2):\n    pass",
    unit_tests: "assert backwardsCombine('abc', 'def') == 'fedcba'\nassert backwardsCombine('hello', 'world') == 'dlrowolleh'\nassert backwardsCombine('', 'a') == 'a'",
    solution: "def backwardsCombine(s1, s2):\n    return (s1 + s2)[::-1]"
  },
  {
    tag: "csedm",
    problem_name: "singlePigLatin",
    week: 3,
    knowledge_component: "string_manip",
    topic: "String Manipulation",
    problem_description: "Write a function `singlePigLatin(word)` that takes a lowercase word containing only letters. If the word starts with a vowel (a,e,i,o,u), return the word with 'yay' appended. Otherwise, move the first letter to the end and append 'ay'.",
    starter_code: "def singlePigLatin(word):\n    pass",
    unit_tests: "assert singlePigLatin('apple') == 'appleyay'\nassert singlePigLatin('banana') == 'ananabay'\nassert singlePigLatin('eat') == 'eatyay'\nassert singlePigLatin('hello') == 'ellohay'",
    solution: "def singlePigLatin(word):\n    vowels = 'aeiou'\n    if word[0] in vowels:\n        return word + 'yay'\n    else:\n        return word[1:] + word[0] + 'ay'"
  },
  {
    tag: "csedm",
    problem_name: "oneToN",
    week: 5,
    knowledge_component: "loops",
    topic: "Loops",
    problem_description: "Write a function `oneToN(n)` that takes a positive integer `n` and returns a list containing the numbers from 1 up to `n` (inclusive).",
    starter_code: "def oneToN(n):\n    pass",
    unit_tests: "assert oneToN(5) == [1, 2, 3, 4, 5]\nassert oneToN(1) == [1]\nassert oneToN(3) == [1, 2, 3]",
    solution: "def oneToN(n):\n    return list(range(1, n + 1))"
  }
];

// Supplementary Analogous Problems
const csedm2Problems = [
  {
    tag: "csedm2",
    problem_name: "helloClass",
    week: 1,
    knowledge_component: "io_basics",
    topic: "I/O Basics",
    problem_description: "Write a function `helloClass()` that prints the string 'Hello Class!' to the console.",
    starter_code: "def helloClass():\n    pass",
    unit_tests: "import sys, io\nout = io.StringIO()\nsys.stdout = out\nhelloClass()\nsys.stdout = sys.__stdout__\nassert out.getvalue().strip() == 'Hello Class!'",
    solution: "def helloClass():\n    print('Hello Class!')"
  },
  {
    tag: "csedm2",
    problem_name: "floatToInt",
    week: 2,
    knowledge_component: "io_basics",
    topic: "I/O Basics",
    problem_description: "Write a function `floatToInt(x)` that takes a floating point number `x` and returns it as an integer.",
    starter_code: "def floatToInt(x):\n    pass",
    unit_tests: "assert type(floatToInt(5.9)) == int\nassert floatToInt(5.9) == 5\nassert floatToInt(-10.1) == -10\nassert floatToInt(0.0) == 0",
    solution: "def floatToInt(x):\n    return int(x)"
  },
  {
    tag: "csedm2",
    problem_name: "tripleX",
    week: 2,
    knowledge_component: "io_basics",
    topic: "I/O Basics",
    problem_description: "Write a function `tripleX(x)` that returns the given number multiplied by 3.",
    starter_code: "def tripleX(x):\n    pass",
    unit_tests: "assert tripleX(5) == 15\nassert tripleX(0) == 0\nassert tripleX(-3) == -9\nassert tripleX(2.5) == 7.5",
    solution: "def tripleX(x):\n    return x * 3"
  },
  {
    tag: "csedm2",
    problem_name: "sumOfSquares",
    week: 2,
    knowledge_component: "arithmetic",
    topic: "Arithmetic",
    problem_description: "Write a function `sumOfSquares(a, b)` that returns the sum of the squares of `a` and `b`.",
    starter_code: "def sumOfSquares(a, b):\n    pass",
    unit_tests: "assert sumOfSquares(2, 3) == 13\nassert sumOfSquares(0, 5) == 25\nassert sumOfSquares(-2, 2) == 8",
    solution: "def sumOfSquares(a, b):\n    return (a ** 2) + (b ** 2)"
  },
  {
    tag: "csedm2",
    problem_name: "convertToRadians",
    week: 2,
    knowledge_component: "arithmetic",
    topic: "Arithmetic",
    problem_description: "Write a function `convertToRadians(degrees)` that takes an angle in degrees and converts it to radians. (Assume pi = 3.14159, formula: radians = degrees * pi / 180, return rounded to 4 decimal places).",
    starter_code: "def convertToRadians(degrees):\n    pass",
    unit_tests: "assert convertToRadians(180) == 3.1416\nassert convertToRadians(90) == 1.5708\nassert convertToRadians(0) == 0.0",
    solution: "def convertToRadians(degrees):\n    return round(degrees * 3.14159 / 180, 4)"
  },
  {
    tag: "csedm2",
    problem_name: "remainingSlices",
    week: 2,
    knowledge_component: "modular_arith",
    topic: "Modular Arithmetic",
    problem_description: "Write a function `remainingSlices(slices, people)` that calculates how many pizza slices are left over if they are divided equally among the people.",
    starter_code: "def remainingSlices(slices, people):\n    pass",
    unit_tests: "assert remainingSlices(10, 3) == 1\nassert remainingSlices(15, 5) == 0\nassert remainingSlices(8, 5) == 3",
    solution: "def remainingSlices(slices, people):\n    return slices % people"
  },
  {
    tag: "csedm2",
    problem_name: "howManyVans",
    week: 2,
    knowledge_component: "modular_arith",
    topic: "Modular Arithmetic",
    problem_description: "Write a function `howManyVans(people)` that takes the total number of people and returns the number of 8-person vans needed to transport them (a van can be partially full).",
    starter_code: "def howManyVans(people):\n    pass",
    unit_tests: "assert howManyVans(16) == 2\nassert howManyVans(17) == 3\nassert howManyVans(0) == 0\nassert howManyVans(1) == 1",
    solution: "def howManyVans(people):\n    return (people + 7) // 8"
  },
  {
    tag: "csedm2",
    problem_name: "removeLastDigit",
    week: 2,
    knowledge_component: "modular_arith",
    topic: "Modular Arithmetic",
    problem_description: "Write a function `removeLastDigit(n)` that returns the integer `n` with its rightmost digit removed. Assume `n` is non-negative.",
    starter_code: "def removeLastDigit(n):\n    pass",
    unit_tests: "assert removeLastDigit(1234) == 123\nassert removeLastDigit(9) == 0\nassert removeLastDigit(100) == 10",
    solution: "def removeLastDigit(n):\n    return n // 10"
  },
  {
    tag: "csedm2",
    problem_name: "nearestWaterFountain",
    week: 2,
    knowledge_component: "modular_arith",
    topic: "Modular Arithmetic",
    problem_description: "There are water fountains every 10 meters (at meter 0, 10, 20, etc.). Write a function `nearestWaterFountain(position)` that takes a position in meters and returns the position of the nearest water fountain. If it's a tie, round up.",
    starter_code: "def nearestWaterFountain(position):\n    pass",
    unit_tests: "assert nearestWaterFountain(3) == 0\nassert nearestWaterFountain(8) == 10\nassert nearestWaterFountain(15) == 20\nassert nearestWaterFountain(20) == 20",
    solution: "def nearestWaterFountain(position):\n    return ((position + 5) // 10) * 10"
  },
  {
    tag: "csedm2",
    problem_name: "hasThreeDigits",
    week: 4,
    knowledge_component: "conditionals",
    topic: "Conditionals",
    problem_description: "Write a function `hasThreeDigits(n)` that returns True if the given positive integer `n` has exactly three digits, and False otherwise.",
    starter_code: "def hasThreeDigits(n):\n    pass",
    unit_tests: "assert hasThreeDigits(100) == True\nassert hasThreeDigits(999) == True\nassert hasThreeDigits(99) == False\nassert hasThreeDigits(1000) == False",
    solution: "def hasThreeDigits(n):\n    return 100 <= n <= 999"
  },
  {
    tag: "csedm2",
    problem_name: "boilingPoint",
    week: 4,
    knowledge_component: "conditionals",
    topic: "Conditionals",
    problem_description: "Write a function `boilingPoint(temp_celsius)` that returns True if `temp_celsius` is greater than or equal to 100, and False otherwise.",
    starter_code: "def boilingPoint(temp_celsius):\n    pass",
    unit_tests: "assert boilingPoint(100) == True\nassert boilingPoint(105) == True\nassert boilingPoint(99) == False",
    solution: "def boilingPoint(temp_celsius):\n    return temp_celsius >= 100"
  },
  {
    tag: "csedm2",
    problem_name: "canVote",
    week: 4,
    knowledge_component: "conditionals",
    topic: "Conditionals",
    problem_description: "Write a function `canVote(age)` that returns True if `age` is 18 or older, and False otherwise.",
    starter_code: "def canVote(age):\n    pass",
    unit_tests: "assert canVote(18) == True\nassert canVote(19) == True\nassert canVote(17) == False\nassert canVote(0) == False",
    solution: "def canVote(age):\n    return age >= 18"
  },
  {
    tag: "csedm2",
    problem_name: "isOddNegativeInt",
    week: 4,
    knowledge_component: "conditionals",
    topic: "Conditionals",
    problem_description: "Write a function `isOddNegativeInt(n)` that returns True if `n` is an odd negative integer (i.e. strictly less than 0 and not divisible by 2).",
    starter_code: "def isOddNegativeInt(n):\n    pass",
    unit_tests: "assert isOddNegativeInt(-3) == True\nassert isOddNegativeInt(-1) == True\nassert isOddNegativeInt(0) == False\nassert isOddNegativeInt(-2) == False\nassert isOddNegativeInt(3) == False",
    solution: "def isOddNegativeInt(n):\n    return n < 0 and n % 2 != 0"
  },
  {
    tag: "csedm2",
    problem_name: "findLog",
    week: 8,
    knowledge_component: "functions_params",
    topic: "Functions and Parameters",
    problem_description: "Write a function `findLog(x)` that returns the base-10 logarithm of `x`. You must import the math module and use its log10 function.",
    starter_code: "def findLog(x):\n    pass",
    unit_tests: "assert findLog(10) == 1.0\nassert findLog(100) == 2.0\nassert findLog(1) == 0.0",
    solution: "import math\ndef findLog(x):\n    return math.log10(x)"
  },
  {
    tag: "csedm2",
    problem_name: "isVowel",
    week: 3,
    knowledge_component: "string_manip",
    topic: "String Manipulation",
    problem_description: "Write a function `isVowel(c)` that takes a single character string and returns True if it is a lowercase vowel ('a', 'e', 'i', 'o', 'u'), and False otherwise.",
    starter_code: "def isVowel(c):\n    pass",
    unit_tests: "assert isVowel('a') == True\nassert isVowel('e') == True\nassert isVowel('b') == False\nassert isVowel(' ') == False",
    solution: "def isVowel(c):\n    return c in ['a', 'e', 'i', 'o', 'u']"
  },
  {
    tag: "csedm2",
    problem_name: "firstThree",
    week: 3,
    knowledge_component: "string_manip",
    topic: "String Manipulation",
    problem_description: "Write a function `firstThree(s)` that takes a string `s` of at least length 3 and returns a new string containing only the first three characters of `s`.",
    starter_code: "def firstThree(s):\n    pass",
    unit_tests: "assert firstThree('hello') == 'hel'\nassert firstThree('world') == 'wor'\nassert firstThree('abc') == 'abc'",
    solution: "def firstThree(s):\n    return s[:3]"
  },
  {
    tag: "csedm2",
    problem_name: "reverseAndCapitalize",
    week: 3,
    knowledge_component: "string_manip",
    topic: "String Manipulation",
    problem_description: "Write a function `reverseAndCapitalize(s)` that takes a string, reverses it, and converts it entirely to uppercase.",
    starter_code: "def reverseAndCapitalize(s):\n    pass",
    unit_tests: "assert reverseAndCapitalize('abc') == 'CBA'\nassert reverseAndCapitalize('hello') == 'OLLEH'\nassert reverseAndCapitalize('a') == 'A'",
    solution: "def reverseAndCapitalize(s):\n    return s[::-1].upper()"
  },
  {
    tag: "csedm2",
    problem_name: "secretCode",
    week: 3,
    knowledge_component: "string_manip",
    topic: "String Manipulation",
    problem_description: "Write a function `secretCode(word)` that takes a string, reverses it, and appends 'xyz' to the end.",
    starter_code: "def secretCode(word):\n    pass",
    unit_tests: "assert secretCode('apple') == 'elppaxyz'\nassert secretCode('cat') == 'tacxyz'\nassert secretCode('a') == 'axyz'",
    solution: "def secretCode(word):\n    return word[::-1] + 'xyz'"
  },
  {
    tag: "csedm2",
    problem_name: "nToOne",
    week: 5,
    knowledge_component: "loops",
    topic: "Loops",
    problem_description: "Write a function `nToOne(n)` that takes a positive integer `n` and returns a list containing the numbers counting down from `n` to 1 (inclusive).",
    starter_code: "def nToOne(n):\n    pass",
    unit_tests: "assert nToOne(5) == [5, 4, 3, 2, 1]\nassert nToOne(1) == [1]\nassert nToOne(3) == [3, 2, 1]",
    solution: "def nToOne(n):\n    return list(range(n, 0, -1))"
  }
];

export const seedQuestions = mutation(async ({ db }) => {
  // We create a parent course for these problems
  const courseId = await db.insert("course", {
    course_name: "Introduction to Python (CSEDM 2019 - A/B Groups)",
    course_language: "Python",
  });

  // Helper function to insert an array of problems
  const insertProblems = async (problemsArray: any[]) => {
    for (const problem of problemsArray) {
      await db.insert("questions", {
        week: problem.week,
        course: courseId,
        problem_name: problem.problem_name,
        problem_description: problem.problem_description,
        knowledge_component: problem.knowledge_component,
        topic: problem.topic,
        tag: problem.tag,
        starter_code: problem.starter_code,
        unit_tests: problem.unit_tests,
        solution: problem.solution,
      });
    }
  };

  // Insert both sets
  await insertProblems(csedmProblems);
  await insertProblems(csedm2Problems);
});
