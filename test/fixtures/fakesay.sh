#!/bin/bash
# Stand-in for macOS `say` in tests: a fixed voice list (no German one with NO_GERMAN=1), and the arguments and text it
# would read, written to $SAID; SLOW=1 makes the voice list take a moment.
if [ "$2" = "?" ]; then
  [ -n "$SLOW" ] && sleep 0.5
  printf 'Daniel              en_GB    # Hello! My name is Daniel.\n'
  [ -z "$NO_GERMAN" ] && printf 'Anna (German (Germany)) de_DE    # Hallo! Ich heiße Anna.\nFlo (German (Germany)) de_DE    # Hallo! Ich heiße Flo.\n'
  exit 0
fi
text=$(cat)
[ -n "$HOLD" ] && sleep 2
echo "$* | $text" >> "$SAID"
