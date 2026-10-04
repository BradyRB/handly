ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_valid" CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE "ServicePublication" ADD CONSTRAINT "Publication_price_positive" CHECK ("basePrice" > 0);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_amount_positive" CHECK (amount > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK (amount > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_currency_dop" CHECK (currency = 'DOP');
ALTER TABLE "ContractorProfile" ADD CONSTRAINT "Contractor_experience_valid" CHECK ("experienceYears" BETWEEN 0 AND 70);
ALTER TABLE "ContractorProfile" ADD CONSTRAINT "Contractor_coordinates_pair" CHECK ((latitude IS NULL) = (longitude IS NULL));
ALTER TABLE "ContractorProfile" ADD CONSTRAINT "Contractor_latitude_valid" CHECK (latitude BETWEEN -90 AND 90);
ALTER TABLE "ContractorProfile" ADD CONSTRAINT "Contractor_longitude_valid" CHECK (longitude BETWEEN -180 AND 180);
