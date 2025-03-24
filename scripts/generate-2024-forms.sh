#!/bin/bash

# Create the output directory if it doesn't exist
mkdir -p src/forms/Y2024/irsForms

# Generate TypeScript files for each PDF form
for pdf in public/forms/Y2024/irs/*.pdf; do
    filename=$(basename "$pdf")
    basename="${filename%.*}"
    # Convert first letter to uppercase using tr
    capitalized=$(echo "$basename" | tr '[:lower:]' '[:upper:]' | cut -c1)$(echo "$basename" | cut -c2-)
    outfile="src/forms/Y2024/irsForms/$capitalized.ts"
    echo "Generating $outfile from $pdf..."
    # Run formgen and clean up the output
    npm run formgen "$pdf" 2>/dev/null | \
        grep -v "^>" | \
        grep -v "^/" | \
        grep -v "Removing XFA" | \
        grep -v "$pdf" | \
        sed '/./,$!d' > "$outfile"
done

echo "Done generating 2024 form models!" 