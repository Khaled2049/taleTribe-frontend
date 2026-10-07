import { WriterAgreementGate } from "@/components/legal/WriterAgreementGate";
import { SimpleEditor } from "../../components/editor/SimpleEditor";

const CreateStory = () => {
  return (
    // h-full fills the available space defined by NavbarWrapper (Screen - Padding)
    <div className="h-full bg-ns-bg">
      <WriterAgreementGate>
        <SimpleEditor />
      </WriterAgreementGate>
    </div>
  );
};

export default CreateStory;
