import { SEOHead } from "@/components/seo/SEOHead";
import { APP_NAME } from "@/config/seo";

const PrivacyPolicy = () => {
  return (
    <>
      <SEOHead
        title={`Privacy Policy - ${APP_NAME}`}
        description={`Read ${APP_NAME}'s Privacy Policy to understand how we collect, use, and protect your personal information.`}
        url="/privacy-policy"
        canonical="/privacy-policy"
      />
      <div className="privacy-policy p-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p>Last Updated: 11/09/2024</p>

        <h2 className="text-2xl font-semibold mt-6 mb-3">
          1. Information Collection and Use
        </h2>
        <p>
          Our story writing application collects personal information when you
          sign up, including your email address, username, and any content you
          create or post. This information is used to provide access to our
          services, allow you to read and write stories, create posts, and
          participate in our community. We are committed to protecting your
          privacy and only use your information to enhance your experience on
          our platform.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-3">2. Use of Data</h2>
        <p>
          We use the data collected to operate and maintain our application,
          improve the user experience, and provide personalized services. Data
          may also be used to troubleshoot issues, communicate updates, and
          analyze usage trends. Your data is used exclusively to support and
          enhance our application and its features.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-3">
          3. Legal Basis for Processing Personal Data
        </h2>
        <p>
          For all users, our basis for collecting and using personal information
          is rooted in the nature of the data provided and its intended purpose.
          By using our service and submitting your data, you consent to our use
          of this information, including actions we may take to improve, modify,
          or personalize our services. While we take reasonable measures to
          secure your data, please be aware that there may be instances where
          data could become inaccessible, lost, or otherwise unavailable.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-3">
          4. Retention of Data
        </h2>
        <p>
          We will retain your personal data only for as long as is necessary for
          the purposes set out in this Privacy Policy. We will retain and use
          your data to the extent necessary to comply with legal obligations,
          resolve disputes, and enforce our agreements.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-3">
          5. Transfer of Data
        </h2>
        <p>
          Your information, including personal data, may be transferred to and
          maintained on servers located outside of your country or other
          governmental jurisdiction, where data protection laws may differ from
          those of your jurisdiction. Data, including personal information
          provided by users outside the United States, may be transferred to and
          processed in the United States. By using this website and submitting
          your information, you consent to this transfer and acknowledge that we
          may retain ownership rights over the data you provide, utilizing it in
          accordance with this Privacy Policy
        </p>
        <p>
          Your consent to this Privacy Policy, followed by your submission of
          such information, represents your agreement to that transfer.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-3">
          6. Data Rights for U.S. Citizens
        </h2>
        <p>
          While data protection laws in the United States vary, certain rights
          may be available to you depending on your state of residence. For
          instance, under the California Consumer Privacy Act (CCPA), California
          residents have specific data protection rights, including the right to
          access, update, or delete the personal information we hold about them.
          Additionally, in certain circumstances, you may have the right to
          restrict or object to the processing of your personal data.
        </p>
        <p>
          If you wish to exercise these rights, please contact us using the
          contact details provided in our application. Note that the
          availability of these rights may depend on your location and
          applicable state laws.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-3">
          7. Security of Data
        </h2>
        <p>
          We take the security of your data seriously and implement reasonable
          measures to protect your information. However, no method of
          transmission over the internet or electronic storage is 100% secure,
          and we cannot guarantee its absolute security.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-3">Disclaimer</h2>
        <p>
          Please note that this Privacy Policy is provided for general
          informational purposes and may not be fully compliant with all
          applicable laws and regulations in your jurisdiction. We recommend
          consulting with a legal professional to ensure that your Privacy
          Policy complies with all relevant privacy laws and regulations.
        </p>
      </div>
    </>
  );
};

export default PrivacyPolicy;
