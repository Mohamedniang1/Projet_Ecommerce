from uuid import uuid4

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, style={"input_type": "password"},)

    first_name = serializers.CharField(max_length=150, required=True)
    last_name = serializers.CharField(max_length=150, required=True)

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "password")
        read_only_fields = ("id",)

    def validate_email(self,value):
        email = value.strip().lower()

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate(self,attrs):
        user = User(
            email=attrs["email"],
            first_name=attrs["first_name"],
            last_name=attrs["last_name"],
        )

        try:
            validate_password(attrs["password"], user=user)
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                {"password": error.messages}
            )

        return attrs

    def create(self, validated_data):
        return User.objects.create_user(
            username=uuid4().hex,
            role=User.Role.CLIENT,
            **validated_data,
        )
    
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
    )

    remember = serializers.BooleanField(
        default=False,
        write_only=True,
    )

    def validate(self, attrs):
        email = attrs["email"].strip().lower()

        user = authenticate(
            request=self.context.get("request"),
            email=email,
            password=attrs["password"],
        )

        if user is None:
            raise serializers.ValidationError(
                "Adresse e-mail ou mot de passe incorrect."
            )

        return {
            "user": user,
            "remember": attrs["remember"],
        }

class ProfileSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(
        max_length=150,
        allow_blank=False,
        trim_whitespace=True,
    )
    last_name = serializers.CharField(
        max_length=150,
        allow_blank=False,
        trim_whitespace=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
        )
        read_only_fields = ("id", "email", "role")

    def validate(self, attrs):
        forbidden_fields = set(self.initial_data) - {
            "first_name",
            "last_name",
        }

        if forbidden_fields:
            raise serializers.ValidationError(
                "Seuls le prénom et le nom peuvent être modifiés."
            )

        return attrs

