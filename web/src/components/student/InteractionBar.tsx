import { Button } from "../ui/button";

export default function CodingBar({ onSubmit }: { onSubmit: () => void }) {
    return (
        <>
            <Button onClick={onSubmit}>Submit code</Button>
        </>
    )
}